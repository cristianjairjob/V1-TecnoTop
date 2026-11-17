const { spawnSync } = require("node:child_process");
if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL no configurada: compilación sin migraciones.");
  process.exit(0);
}
const url = new URL(process.env.DATABASE_URL);
if (url.hostname === "localhost") url.hostname = "127.0.0.1";
process.env.DATABASE_URL = url.toString();
for (const args of [
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
