# 웹 학습 아카이브 앱 상세 설계 (MVP v1)

## 1) 기준 범위
- 목표: 웹페이지를 정돈된 본문으로 저장하고, 제목/태그/폴더로 다시 찾아 학습
- 우선순위: `수집 -> 정제 -> 저장 -> 검색 -> 열람`
- 단일 사용자 로컬 앱(로그인 없음) 기준

---

## 2) 실제 DB 스키마 (SQLite)

### 2.1 엔티티 개요
- `documents`: 정제된 학습 문서 본문
- `captures`: 원본 HTML 및 추출 메타데이터
- `tags`, `document_tags`: 태그 다대다
- `folders`, `document_folders`: 폴더 다대다
- `import_jobs`: URL 수집/정제 비동기 작업 상태
- `documents_fts`: 전문검색(FTS5)

### 2.2 DDL
```sql
PRAGMA foreign_keys = ON;

-- 문서 본체
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,                         -- UUID
  source_url TEXT NOT NULL,
  canonical_url TEXT,
  source_domain TEXT,
  title TEXT NOT NULL,
  user_title TEXT,                             -- 사용자가 수정한 제목
  excerpt TEXT,
  content_markdown TEXT NOT NULL,
  content_html TEXT,                           -- 렌더링 최적화용 (선택)
  author TEXT,
  published_at TEXT,                           -- ISO8601
  language TEXT DEFAULT 'ko',
  reading_minutes INTEGER DEFAULT 0,
  content_hash TEXT,                           -- 중복 탐지용
  status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','processing','failed','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_source_domain ON documents(source_domain);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);

-- 수집 원본/추출 로그
CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,                         -- UUID
  document_id TEXT NOT NULL,
  raw_html TEXT,                               -- 옵션 저장
  cleaned_html TEXT,
  extractor TEXT NOT NULL,                     -- ex) readability@0.5.x
  extractor_version TEXT,
  extract_score REAL,                          -- 품질 점수(0~1)
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_captures_document_id ON captures(document_id);

-- 태그
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,                         -- UUID
  name TEXT NOT NULL UNIQUE,                   -- 소문자 정규화 권장
  color TEXT DEFAULT '#4A5568',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 문서-태그 매핑
CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);

-- 폴더
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,                         -- UUID
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 문서-폴더 매핑 (문서 하나를 여러 폴더에 둘 수 있게 설계)
CREATE TABLE IF NOT EXISTS document_folders (
  document_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (document_id, folder_id),
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_folders_folder_id ON document_folders(folder_id);

-- 가져오기 작업 큐
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,                         -- UUID
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','fetching','extracting','saving','done','failed')),
  progress INTEGER NOT NULL DEFAULT 0,         -- 0~100
  document_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);
```

### 2.3 전문검색(FTS5) + 트리거
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  document_id UNINDEXED,
  title,
  content_markdown,
  excerpt,
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS trg_documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(document_id, title, content_markdown, excerpt)
  VALUES (new.id, COALESCE(new.user_title, new.title), new.content_markdown, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_au AFTER UPDATE ON documents BEGIN
  DELETE FROM documents_fts WHERE document_id = old.id;
  INSERT INTO documents_fts(document_id, title, content_markdown, excerpt)
  VALUES (new.id, COALESCE(new.user_title, new.title), new.content_markdown, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_ad AFTER DELETE ON documents BEGIN
  DELETE FROM documents_fts WHERE document_id = old.id;
END;
```

### 2.4 스키마 운영 규칙
- `title`은 추출 제목, `user_title`은 사용자 편집 제목 (UI 표시는 `COALESCE(user_title, title)`)
- 삭제는 초기엔 물리 삭제 가능, 운영 단계에선 `status='archived'` 권장
- URL 중복 저장 허용(버전 기록)하되, `content_hash`로 중복 안내

---

## 3) API 명세 (REST, `/api/v1`)

### 3.1 공통 규칙
- Content-Type: `application/json`
- 시간 포맷: ISO8601 UTC 문자열
- 페이지네이션: `page`(1-base), `limit`(기본 20, 최대 100)
- 에러 응답 포맷:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "url is required",
    "details": {
      "field": "url"
    }
  }
}
```

### 3.2 Documents

#### `POST /documents/import`
URL을 받아 수집 작업 생성. 기본 비동기.

Request:
```json
{
  "url": "https://example.com/article",
  "title": "선택 제목",
  "tags": ["react", "web"],
  "folder_ids": ["fld_1"],
  "save_raw_html": false
}
```

Response `202 Accepted`:
```json
{
  "job_id": "job_123",
  "status": "queued"
}
```

#### `GET /documents`
목록 조회(검색/필터/정렬)

Query:
- `q`: 검색어(FTS)
- `tag`: 태그명
- `folder_id`
- `status`: `ready|processing|failed|archived`
- `sort`: `created_at|title`
- `order`: `asc|desc`
- `page`, `limit`

Response `200`:
```json
{
  "items": [
    {
      "id": "doc_1",
      "title": "React useEffect 정리",
      "display_title": "React useEffect 정리",
      "source_url": "https://example.com/article",
      "source_domain": "example.com",
      "excerpt": "핵심 요약...",
      "tags": ["react"],
      "folder_ids": ["fld_1"],
      "status": "ready",
      "created_at": "2026-02-11T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 134
  }
}
```

#### `GET /documents/{id}`
문서 상세 조회

Response `200`:
```json
{
  "id": "doc_1",
  "title": "원본 제목",
  "user_title": "수정 제목",
  "display_title": "수정 제목",
  "source_url": "https://example.com/article",
  "content_markdown": "# 본문 ...",
  "content_html": "<h1>본문 ...</h1>",
  "tags": ["react", "hooks"],
  "folder_ids": ["fld_1"],
  "reading_minutes": 8,
  "status": "ready",
  "created_at": "2026-02-11T10:00:00Z",
  "updated_at": "2026-02-11T10:10:00Z"
}
```

#### `PATCH /documents/{id}`
제목/태그/폴더/본문 수정

Request:
```json
{
  "user_title": "새 제목",
  "content_markdown": "# 수정 본문",
  "tags": ["react", "study"],
  "folder_ids": ["fld_1", "fld_2"]
}
```

Response `200`: 수정된 문서 객체

#### `DELETE /documents/{id}`
문서 삭제(초기 물리 삭제, 운영에서는 아카이브 가능)

Response `204 No Content`

### 3.3 Jobs

#### `GET /jobs/{id}`
수집/정제 작업 상태 조회

Response `200`:
```json
{
  "id": "job_123",
  "url": "https://example.com/article",
  "status": "extracting",
  "progress": 60,
  "document_id": null,
  "error_message": null,
  "created_at": "2026-02-11T10:00:00Z",
  "updated_at": "2026-02-11T10:00:10Z"
}
```

### 3.4 Tags

#### `GET /tags`
태그 목록 조회

#### `POST /tags`
태그 생성

Request:
```json
{
  "name": "react",
  "color": "#0EA5E9"
}
```

#### `DELETE /tags/{id}`
태그 삭제 (연결 매핑도 제거)

### 3.5 Folders

#### `GET /folders`
폴더 목록

#### `POST /folders`
폴더 생성

Request:
```json
{
  "name": "프론트엔드",
  "description": "UI/UX 및 React 학습"
}
```

#### `PATCH /folders/{id}`
폴더명/설명 수정

#### `DELETE /folders/{id}`
폴더 삭제(문서 자체는 유지, 매핑만 제거)

### 3.6 상태 코드 기준
- `200` 성공 조회/수정
- `201` 생성 성공
- `202` 비동기 작업 생성
- `204` 삭제 성공
- `400` 검증 오류
- `404` 미존재 리소스
- `409` 중복(예: 태그명)
- `500` 서버 오류

---

## 4) 화면 와이어프레임 (ASCII)

### 4.1 화면 A: 저장(수집) 화면
```text
+--------------------------------------------------------------------------------+
| 로고 | 보관함 | 태그 | 폴더 | 설정                                             |
+--------------------------------------------------------------------------------+
| [URL 입력창: https://...] [가져오기]                                            |
|--------------------------------------------------------------------------------|
| 미리보기                                                                       |
|  제목: [자동 추출 제목_________________________]                                |
|  태그: [react] [hooks] [+태그추가]                                              |
|  폴더: [프론트엔드 v]                                                           |
|--------------------------------------------------------------------------------|
| [ ] 원본 HTML도 저장                                                            |
| [취소]                                               [정리 후 저장]             |
+--------------------------------------------------------------------------------+
```

### 4.2 화면 B: 보관함(목록/검색)
```text
+--------------------------------------------------------------------------------+
| 검색: [useEffect cleanup____________________] [검색]                           |
| 필터: 태그[v] 폴더[v] 상태[v]            정렬: 최신순[v]                       |
+-------------------------+------------------------------------------------------+
| 폴더                    | 문서 목록                                             |
| - 전체(134)             | [React useEffect 정리]  example.com  2026-02-11      |
| - 프론트엔드(82)        |  태그: react hooks                                    |
| - 백엔드(52)            |------------------------------------------------------|
|                         | [JS Event Loop 핵심]   mdn.dev      2026-02-10       |
| 태그 클라우드           |  태그: javascript runtime                             |
| #react #js #sql ...     |------------------------------------------------------|
+-------------------------+------------------------------------------------------+
| < 1 2 3 4 >                                                                   |
+--------------------------------------------------------------------------------+
```

### 4.3 화면 C: 문서 상세(읽기 모드)
```text
+--------------------------------------------------------------------------------+
| <- 목록으로 | 제목: React useEffect 정리                      [편집] [삭제]     |
| 원문: https://example.com/article                                                |
| 태그: [react] [hooks]   폴더: [프론트엔드]                                      |
|--------------------------------------------------------------------------------|
| # React useEffect 정리                                                          |
|                                                                                 |
| 본문 마크다운 렌더링 영역                                                       |
| - 코드블록/표/이미지 캡션 유지                                                  |
| - 광고/사이드바 제거                                                            |
|                                                                                 |
|--------------------------------------------------------------------------------|
| 글자크기 [A- A+]  줄간격 [좁게/보통/넓게]  테마 [라이트/다크]                   |
+--------------------------------------------------------------------------------+
```

### 4.4 화면 D: 문서 편집 모달
```text
+---------------------------------------------------------------+
| 문서 편집                                                    X |
| 제목: [수정 제목___________________________________________]   |
| 태그: [react] [hooks] [+추가]                                 |
| 폴더: [프론트엔드 v]                                           |
| 본문(Markdown):                                                |
| [-----------------------------------------------------------]  |
| [ # 제목 ...                                                 ] |
| [ ...                                                        ] |
| [-----------------------------------------------------------]  |
|                                         [취소] [저장]          |
+---------------------------------------------------------------+
```

---

## 5) 구현 순서 (바로 개발 가능한 단위)
1. DB 마이그레이션 생성 (`documents`, `tags`, `folders`, `import_jobs`, FTS)
2. `POST /documents/import` + `GET /jobs/{id}` 구현
3. 추출 파이프라인(Readability -> Markdown 변환 -> 저장) 연결
4. 목록/상세 API(`GET /documents`, `GET /documents/{id}`) 구현
5. 편집 API(`PATCH /documents/{id}`) 및 태그/폴더 API 구현
6. 저장 화면 -> 보관함 -> 상세 화면 순으로 UI 연결

## 6) 수용 기준 (Acceptance Criteria)
- URL 입력 후 10초 이내 `job.status=done` 또는 실패 원인 표시
- 저장된 문서는 광고/사이드바 없이 본문 중심으로 렌더링
- 제목 수정, 태그/폴더 변경 후 목록 필터에 즉시 반영
- 검색어로 제목+본문 FTS 검색 가능
- 문서 상세 열람에서 가독성 옵션(폰트/줄간격) 적용 가능

---

## 7) Infrastructure Update (2026-02-12)
- Database target changed from local SQLite to Supabase PostgreSQL.
- Authoritative DB schema is now `supabase/migrations/202602120001_init.sql`.
- API contract remains `api/openapi.yaml`.
- Deployment target is Vercel + GitHub repository `kinsu128-art/web_summary`.
