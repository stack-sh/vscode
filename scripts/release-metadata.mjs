import assert from "node:assert/strict";
import { appendFile, readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("package.json", "utf8"));
const expectedTag = `v${manifest.version}`;
assert.equal(
  process.env.GITHUB_REF_NAME,
  expectedTag,
  `release tag must be ${expectedTag}`,
);

const outputPath = process.env.GITHUB_OUTPUT;
assert.ok(outputPath, "GITHUB_OUTPUT is required");
const vsixPath = `artifacts/${manifest.name}-${manifest.version}.vsix`;
const checksumPath = `${vsixPath}.sha256`;
await appendFile(
  outputPath,
  `version=${manifest.version}\nvsix_path=${vsixPath}\nchecksum_path=${checksumPath}\n`,
);
