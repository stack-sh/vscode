import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { packageVsix } from "./package-vsix.mjs";

const execFileAsync = promisify(execFile);
const expectedEntries = [
  "[Content_Types].xml",
  "extension.vsixmanifest",
  "extension/LICENSE.txt",
  "extension/PRIVACY.md",
  "extension/SECURITY.md",
  "extension/SUPPORT.md",
  "extension/THIRD_PARTY_NOTICES.md",
  "extension/changelog.md",
  "extension/dist/extension.js",
  "extension/language-configuration.json",
  "extension/package.json",
  "extension/readme.md",
  "extension/syntaxes/stack.tmLanguage.json",
].sort();

const vsixPath = await packageVsix();
const { stdout: entryOutput } = await execFileAsync(
  "unzip",
  ["-Z1", vsixPath],
  {
    encoding: "utf8",
  },
);
const actualEntries = entryOutput.trim().split("\n").sort();
assert.deepEqual(
  actualEntries,
  expectedEntries,
  "VSIX contents differ from the release allowlist",
);

const manifest = JSON.parse(
  await readArchiveEntry(vsixPath, "extension/package.json"),
);
const sourceManifest = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(manifest.name, sourceManifest.name);
assert.equal(manifest.version, sourceManifest.version);
assert.equal(manifest.publisher, sourceManifest.publisher);

for (const path of [
  "language-configuration.json",
  "syntaxes/stack.tmLanguage.json",
]) {
  const [archived, source] = await Promise.all([
    readArchiveEntry(vsixPath, `extension/${path}`),
    readFile(path),
  ]);
  assert.ok(archived.equals(source), `${path} changed while packaging`);
}

const archive = await readFile(vsixPath);
const digest = createHash("sha256").update(archive).digest("hex");
process.stdout.write(
  `${vsixPath}\nsha256 ${digest}\nsize ${archive.byteLength} bytes\n`,
);

async function readArchiveEntry(archivePath, entryPath) {
  const { stdout } = await execFileAsync(
    "unzip",
    ["-p", archivePath, entryPath],
    {
      encoding: "buffer",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return stdout;
}
