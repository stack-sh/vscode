import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const check = process.argv.includes("--check");
const assets = [
  {
    source: fileURLToPath(import.meta.resolve("@stack-sh/language/grammar")),
    destination: "syntaxes/stack.tmLanguage.json",
  },
  {
    source: fileURLToPath(
      import.meta.resolve("@stack-sh/language/language-configuration"),
    ),
    destination: "language-configuration.json",
  },
];

for (const asset of assets) {
  if (check) {
    await access(asset.destination, constants.R_OK).catch(() => {
      throw new Error(
        `${asset.destination} is missing; run npm run sync:language`,
      );
    });
    const [source, destination] = await Promise.all([
      readFile(asset.source),
      readFile(asset.destination),
    ]);
    if (!source.equals(destination)) {
      throw new Error(
        `${asset.destination} differs from @stack-sh/language@0.1.0`,
      );
    }
    continue;
  }

  await mkdir(dirname(asset.destination), { recursive: true });
  await copyFile(asset.source, asset.destination);
}
