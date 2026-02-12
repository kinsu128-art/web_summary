#!/usr/bin/env node

const args = process.argv.slice(2);

const getArg = (name, fallback = undefined) => {
  const found = args.find((arg) => arg.startsWith(`${name}=`));
  if (!found) return fallback;
  return found.slice(name.length + 1);
};

const baseUrl = getArg("--base-url", "https://websummary.vercel.app");
const strict = args.includes("--strict");

const hit = async (path) => {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  return { url, status: res.status, text };
};

const asJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const print = (ok, label, detail = "") => {
  const icon = ok ? "OK " : "FAIL";
  console.log(`[${icon}] ${label}${detail ? ` - ${detail}` : ""}`);
};

const run = async () => {
  console.log(`Deploy verification target: ${baseUrl}`);

  const checks = [];

  const health = await hit("/api/health");
  checks.push({
    name: "health",
    ok: health.status === 200,
    detail: `status=${health.status}`
  });

  const home = await hit("/");
  checks.push({
    name: "home",
    ok: home.status === 200,
    detail: `status=${home.status}`
  });

  const jobs = await hit("/api/v1/jobs");
  checks.push({
    name: "jobs",
    ok: jobs.status === 200 || jobs.status === 503,
    detail: `status=${jobs.status}`
  });

  const setup = await hit("/api/v1/system/setup");
  const setupJson = asJson(setup.text);
  const setupMsg = setupJson?.error?.message ?? (setupJson?.all_ok ? "all_ok" : "");

  checks.push({
    name: "setup",
    ok: strict ? setup.status === 200 : setup.status === 200 || setup.status === 503,
    detail: `status=${setup.status}${setupMsg ? `, message=${setupMsg}` : ""}`
  });

  for (const check of checks) {
    print(check.ok, check.name, check.detail);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("[FAIL] deploy verification crashed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
