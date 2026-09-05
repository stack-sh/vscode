import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = await readJson("package.json");
const lockfile = await readJson("package-lock.json");
const languagePackage = await readJson(
  "node_modules/@stack-sh/language/package.json",
);
const vsceMain = await readFile(
  "node_modules/@vscode/vsce/out/main.js",
  "utf8",
);
const readme = await readFile("README.md", "utf8");
const privacy = await readFile("PRIVACY.md", "utf8");
const thirdPartyNotices = await readFile("THIRD_PARTY_NOTICES.md", "utf8");
const releaseWorkflow = await readFile(
  ".github/workflows/release.yaml",
  "utf8",
);
const workflowFiles = await Promise.all(
  [".github/workflows/ci.yaml", ".github/workflows/release.yaml"].map((path) =>
    readFile(path, "utf8"),
  ),
);

assert.equal(manifest.name, "stack-language");
assert.equal(manifest.displayName, "Stack");
assert.equal(manifest.publisher, "stack-sh");
assert.match(manifest.version, /^\d+\.\d+\.\d+$/u);
assert.deepEqual(manifest.engines, { vscode: "^1.91.0" });
assert.deepEqual(manifest.extensionKind, ["workspace"]);
assert.deepEqual(manifest.activationEvents, ["onLanguage:stack"]);
assert.equal(manifest.capabilities.untrustedWorkspaces.supported, false);
assert.equal(manifest.capabilities.virtualWorkspaces.supported, false);

assert.deepEqual(manifest.contributes.languages, [
  {
    id: "stack",
    aliases: ["Stack", "stack"],
    extensions: [".stack"],
    configuration: "./language-configuration.json",
  },
]);
assert.deepEqual(manifest.contributes.grammars, [
  {
    language: "stack",
    scopeName: "source.stack",
    path: "./syntaxes/stack.tmLanguage.json",
  },
]);
assert.deepEqual(
  manifest.contributes.commands.map(({ command }) => command).sort(),
  [
    "stack.openInstallationGuide",
    "stack.openPlayground",
    "stack.restartLanguageServer",
    "stack.showLanguageServerOutput",
  ],
);
assert.deepEqual(
  manifest.contributes.configuration.properties["stack.server.path"],
  {
    type: "string",
    default: "stack",
    scope: "machine",
    description:
      "Executable path or command name for the Stack CLI. The extension runs it with the fixed `lsp` argument.",
  },
);

assert.deepEqual(manifest.dependencies, {
  "@stack-sh/language": "0.1.0",
  semver: "7.8.5",
  "vscode-languageclient": "10.1.1",
});
assert.equal(
  languagePackage.version,
  manifest.dependencies["@stack-sh/language"],
);
assert.equal(manifest.devDependencies["@vscode/vsce"], "3.9.3-11");
assert.ok(
  vsceMain.includes("--oidc"),
  "the pinned vsce does not support OIDC publishing",
);

const lockRoot = lockfile.packages[""];
for (const key of [
  "name",
  "version",
  "license",
  "dependencies",
  "devDependencies",
  "engines",
]) {
  assert.deepEqual(
    lockRoot[key],
    manifest[key],
    `package-lock root ${key} is stale`,
  );
}

assert.ok(
  /^\| `0\.1\.x`\s+\| `>=1\.91\.0`\s+\| `>=0\.4\.0 <0\.5\.0`\s+\| `@stack-sh\/language` `0\.1\.0`\s+\|$/mu.test(
    readme,
  ),
  "README compatibility table is stale",
);
assert.ok(privacy.includes("does not collect telemetry"));

for (const [path, dependency] of Object.entries(lockfile.packages)) {
  if (
    path === "" ||
    dependency.dev === true ||
    dependency.devOptional === true
  ) {
    continue;
  }
  const name = path.slice(
    path.lastIndexOf("node_modules/") + "node_modules/".length,
  );
  assert.ok(
    thirdPartyNotices.includes(
      `\`${name}\` ${dependency.version} (${dependency.license})`,
    ),
    `THIRD_PARTY_NOTICES.md is missing ${name}@${dependency.version}`,
  );
}

assert.ok(
  releaseWorkflow.includes(
    "vsce publish --oidc --skip-duplicate --packagePath",
  ),
);
assert.ok(!workflowFiles.some((workflow) => workflow.includes("VSCE_PAT")));

for (const workflow of workflowFiles) {
  for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gmu)) {
    const reference = match[1];
    assert.match(
      reference,
      /^[^@]+@[0-9a-f]{40}$/u,
      `action is not pinned by SHA: ${reference}`,
    );
  }
}

for (const excludedPath of [
  ".github/**",
  ".test-bin/**",
  ".test-vsix/**",
  ".vscode-test.mjs",
  "node_modules/**",
  "scripts/**",
  "src/**",
  "test/**",
  "package-lock.json",
  "dist/**/*.map",
]) {
  const ignore = await readFile(".vscodeignore", "utf8");
  assert.ok(
    ignore.split("\n").includes(excludedPath),
    `.vscodeignore must exclude ${excludedPath}`,
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
