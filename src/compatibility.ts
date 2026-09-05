import semver from "semver";

export const MINIMUM_STACK_CLI_VERSION = "0.4.0";
export const SUPPORTED_STACK_CLI_RANGE = ">=0.4.0 <0.5.0";

export type CliCompatibility =
  | { kind: "compatible"; version: string }
  | { kind: "too-old"; version: string }
  | { kind: "too-new"; version: string }
  | { kind: "invalid"; output: string };

export function assessCliVersion(stdout: string): CliCompatibility {
  const output = stdout.trim();
  const match = /^stack ([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)$/.exec(
    output,
  );

  if (match === null) {
    return { kind: "invalid", output };
  }

  const version = match[1];
  if (version === undefined || semver.valid(version) === null) {
    return { kind: "invalid", output };
  }

  if (semver.satisfies(version, SUPPORTED_STACK_CLI_RANGE)) {
    return { kind: "compatible", version };
  }

  if (semver.lt(version, MINIMUM_STACK_CLI_VERSION)) {
    return { kind: "too-old", version };
  }

  return { kind: "too-new", version };
}
