import { execFile } from "node:child_process";

import { assessCliVersion, type CliCompatibility } from "./compatibility";

const VERSION_TIMEOUT_MS = 5_000;
const VERSION_OUTPUT_LIMIT_BYTES = 64 * 1024;

export type CliProbeResult =
  | CliCompatibility
  | { kind: "missing" }
  | { kind: "unavailable"; reason: string };

export function probeStackCli(executable: string): Promise<CliProbeResult> {
  return new Promise((resolve) => {
    execFile(
      executable,
      ["--version"],
      {
        encoding: "utf8",
        maxBuffer: VERSION_OUTPUT_LIMIT_BYTES,
        timeout: VERSION_TIMEOUT_MS,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error === null) {
          resolve(assessCliVersion(stdout));
          return;
        }

        const code: unknown = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          resolve({ kind: "missing" });
          return;
        }

        resolve({
          kind: "unavailable",
          reason: safeProbeFailure(code, error.message),
        });
      },
    );
  });
}

function safeProbeFailure(code: unknown, message: string): string {
  if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) {
    return code;
  }
  if (typeof code === "number" && Number.isSafeInteger(code)) {
    return `exit status ${code}`;
  }

  return message === "" ? "unknown process error" : "process error";
}
