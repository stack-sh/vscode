import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { probeStackCli } from "../../src/cli-probe";

const temporaryDirectories: string[] = [];

void afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

void describe("Stack CLI probing", () => {
  void it("classifies an absent executable without using a shell", async () => {
    const result = await probeStackCli(
      join(tmpdir(), "missing stack executable"),
    );
    assert.deepEqual(result, { kind: "missing" });
  });

  void it(
    "reads exact version output from an executable path containing spaces",
    { skip: process.platform === "win32" },
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "stack cli probe "));
      temporaryDirectories.push(directory);
      const executable = join(directory, "stack fixture");
      await writeFile(
        executable,
        "#!/bin/sh\nprintf 'stack 0.4.0\\n'\n",
        "utf8",
      );
      await chmod(executable, 0o755);

      const result = await probeStackCli(executable);
      assert.deepEqual(result, { kind: "compatible", version: "0.4.0" });
    },
  );

  void it(
    "reports a non-zero executable without exposing its stderr",
    { skip: process.platform === "win32" },
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "stack cli failure "));
      temporaryDirectories.push(directory);
      const executable = join(directory, "stack fixture");
      await writeFile(
        executable,
        "#!/bin/sh\nprintf 'secret detail' >&2\nexit 7\n",
        "utf8",
      );
      await chmod(executable, 0o755);

      const result = await probeStackCli(executable);
      assert.deepEqual(result, {
        kind: "unavailable",
        reason: "exit status 7",
      });
    },
  );
});
