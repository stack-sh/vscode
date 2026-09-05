import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export async function packageVsix() {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const outputPath = `artifacts/${manifest.name}-${manifest.version}.vsix`;

  for (const path of [
    "artifacts",
    "dist",
    "out-test",
    "syntaxes",
    "language-configuration.json",
  ]) {
    await rm(path, { force: true, recursive: true });
  }
  await mkdir("artifacts", { recursive: true });

  await execFileAsync(process.execPath, [
    require.resolve("@vscode/vsce/vsce"),
    "package",
    "--no-dependencies",
    "--out",
    outputPath,
  ]);

  return outputPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${await packageVsix()}\n`);
}
