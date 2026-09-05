import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const VERSION = "0.5.0";
const RELEASE_BASE = `https://github.com/stack-sh/cli/releases/download/v${VERSION}`;
const TARGETS = new Map([
  [
    "darwin:arm64",
    [
      "aarch64-apple-darwin",
      "cfa5e6459481dec73c0aca5b32d52293c977a4f5d72273f8ea9ce71c4f689ea2",
    ],
  ],
  [
    "darwin:x64",
    [
      "x86_64-apple-darwin",
      "d38e017c93a41855319fd583c4f0d6e62dc688b10ebeedbe925d07ba6dbb7e2b",
    ],
  ],
  [
    "linux:arm64",
    [
      "aarch64-unknown-linux-gnu",
      "506a03d1b430497539bfc2c57ff4a97962a983d1343c983700bc85719e5740cb",
    ],
  ],
  [
    "linux:x64",
    [
      "x86_64-unknown-linux-gnu",
      "b159e58c899f77798196616dd1a33fc6a04026cdc582861ee8ac257211abdb9d",
    ],
  ],
]);

export async function prepareIntegrationCli() {
  const platformKey = `${platform()}:${arch()}`;
  const release = TARGETS.get(platformKey);
  if (release === undefined) {
    throw new Error(
      `Stack CLI 0.5.0 has no supported integration target for ${platformKey}`,
    );
  }

  const [target, expectedDigest] = release;
  const cacheDirectory = join(process.cwd(), ".test-bin");
  const archiveName = `stack-v${VERSION}-${target}.tar.gz`;
  const archivePath = join(cacheDirectory, archiveName);
  const rootDirectory = join(cacheDirectory, `stack-v${VERSION}-${target}`);
  const executablePath = join(
    rootDirectory,
    platform() === "win32" ? "stack.exe" : "stack",
  );
  await mkdir(cacheDirectory, { recursive: true });

  let archive;
  try {
    archive = await readFile(archivePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    const response = await fetch(`${RELEASE_BASE}/${archiveName}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `Could not download ${archiveName}: HTTP ${response.status}`,
        {
          cause: error,
        },
      );
    }
    archive = Buffer.from(await response.arrayBuffer());
    const temporaryArchive = `${archivePath}.download`;
    await writeFile(temporaryArchive, archive, { flag: "wx" });
    await rename(temporaryArchive, archivePath);
  }

  const actualDigest = createHash("sha256").update(archive).digest("hex");
  if (actualDigest !== expectedDigest) {
    throw new Error(`${archiveName} digest mismatch`);
  }

  await execFileAsync("tar", ["-xzf", archivePath, "-C", cacheDirectory]);
  await chmod(executablePath, 0o755);
  const { stdout } = await execFileAsync(executablePath, ["--version"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  if (stdout !== `stack ${VERSION}\n`) {
    throw new Error(
      `Unexpected Stack CLI version output: ${JSON.stringify(stdout)}`,
    );
  }

  return executablePath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${await prepareIntegrationCli()}\n`);
}
