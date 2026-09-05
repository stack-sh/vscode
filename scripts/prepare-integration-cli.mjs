import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const VERSION = "0.4.0";
const RELEASE_BASE = `https://github.com/stack-sh/cli/releases/download/v${VERSION}`;
const TARGETS = new Map([
  [
    "darwin:arm64",
    [
      "aarch64-apple-darwin",
      "dd43cf3d966a3dc28de3ac8752b6a98f19e4cb7cf6b04652ab73a013800cb015",
    ],
  ],
  [
    "darwin:x64",
    [
      "x86_64-apple-darwin",
      "48a72328fcf6d160a123a766d9701108f8ee9f633001581dab533b93dddf0827",
    ],
  ],
  [
    "linux:arm64",
    [
      "aarch64-unknown-linux-gnu",
      "a0d76bfa9ed9e767fcd06dbeb7140234db865440210c7c3abf6c3db4f6983a6e",
    ],
  ],
  [
    "linux:x64",
    [
      "x86_64-unknown-linux-gnu",
      "89d8a34c0da5f67932edff2641fe0a0527afbd120cfd5133cb38cdeffca55319",
    ],
  ],
]);

export async function prepareIntegrationCli() {
  const platformKey = `${platform()}:${arch()}`;
  const release = TARGETS.get(platformKey);
  if (release === undefined) {
    throw new Error(
      `Stack CLI 0.4.0 has no supported integration target for ${platformKey}`,
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
