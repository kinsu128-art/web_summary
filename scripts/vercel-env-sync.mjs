#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const kv = Object.fromEntries(
  args
    .filter((a) => a.includes("="))
    .map((a) => {
      const idx = a.indexOf("=");
      return [a.slice(0, idx), a.slice(idx + 1)];
    })
);

const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((k) => !kv[k]);

if (missing.length > 0) {
  console.error(`Missing args: ${missing.join(", ")}`);
  console.error(
    "Usage: node scripts/vercel-env-sync.mjs NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=..."
  );
  process.exit(1);
}

const run = (command, input) => {
  const result = spawnSync(command, {
    shell: true,
    stdio: ["pipe", "pipe", "pipe"],
    input,
    encoding: "utf-8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: ${command}`);
  }
  return result.stdout;
};

for (const key of required) {
  for (const target of ["production", "preview", "development"]) {
    try {
      run(`vercel env rm ${key} ${target} --yes`, "");
    } catch {
      // ignore if not exists
    }
    run(`vercel env add ${key} ${target}`, `${kv[key]}\n`);
    console.log(`Updated ${key} (${target})`);
  }
}

console.log("Vercel environment variables updated.");
