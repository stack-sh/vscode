import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [archivePath, checksumPath] = process.argv.slice(2);
if (archivePath === undefined || checksumPath === undefined) {
  throw new Error(
    "usage: node scripts/create-checksum.mjs <archive> <checksum>",
  );
}

const archive = await readFile(archivePath);
const digest = createHash("sha256").update(archive).digest("hex");
await writeFile(checksumPath, `${digest}  ${archivePath.split("/").at(-1)}\n`, {
  flag: "wx",
});
