import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const archivePath = `artifacts/${manifest.name}-${manifest.version}.vsix`;
const destination = ".test-vsix";

await rm(destination, { force: true, recursive: true });
await mkdir(destination, { recursive: true });
await execFileAsync("unzip", [
  "-q",
  archivePath,
  "extension/*",
  "-d",
  destination,
]);
