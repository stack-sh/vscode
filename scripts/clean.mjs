import { rm } from "node:fs/promises";

for (const path of [
  ".test-vsix",
  "artifacts",
  "dist",
  "out-test",
  "syntaxes",
  "language-configuration.json",
]) {
  await rm(path, { force: true, recursive: true });
}
