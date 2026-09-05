import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MINIMUM_STACK_CLI_VERSION,
  SUPPORTED_STACK_CLI_RANGE,
  assessCliVersion,
} from "../../src/compatibility";

void describe("Stack CLI compatibility", () => {
  void it("accepts stable versions in the verified pre-1.0 minor range", () => {
    assert.deepEqual(assessCliVersion("stack 0.4.0\n"), {
      kind: "compatible",
      version: "0.4.0",
    });
    assert.deepEqual(assessCliVersion("stack 0.4.99"), {
      kind: "compatible",
      version: "0.4.99",
    });
    assert.deepEqual(assessCliVersion("stack 0.5.0"), {
      kind: "compatible",
      version: "0.5.0",
    });
    assert.equal(MINIMUM_STACK_CLI_VERSION, "0.4.0");
    assert.equal(SUPPORTED_STACK_CLI_RANGE, ">=0.4.0 <0.6.0");
  });

  void it("distinguishes older and unverified newer CLIs", () => {
    assert.deepEqual(assessCliVersion("stack 0.3.9"), {
      kind: "too-old",
      version: "0.3.9",
    });
    assert.deepEqual(assessCliVersion("stack 0.6.0"), {
      kind: "too-new",
      version: "0.6.0",
    });
    assert.deepEqual(assessCliVersion("stack 1.0.0"), {
      kind: "too-new",
      version: "1.0.0",
    });
  });

  void it("rejects malformed, ambiguous, and prerelease output", () => {
    for (const output of [
      "",
      "0.4.0",
      "stack v0.4.0",
      "stack 0.4",
      "stack 0.4.0\nextra",
      "other 0.4.0",
    ]) {
      assert.deepEqual(assessCliVersion(output), {
        kind: "invalid",
        output: output.trim(),
      });
    }

    assert.deepEqual(assessCliVersion("stack 0.4.1-rc.1"), {
      kind: "too-new",
      version: "0.4.1-rc.1",
    });
  });
});
