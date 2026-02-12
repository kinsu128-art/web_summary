import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인수의 공부노트",
  description: "Web study archive API and app scaffold"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
