import { defineConfig } from "@vscode/test-cli";

const shared = {
  files: "out-test/test/integration/**/*.test.js",
  extensionDevelopmentPath: ".test-vsix/extension",
  workspaceFolder: "test/fixtures/workspace",
  launchArgs: [
    "--disable-workspace-trust",
    "--disable-updates",
    "--skip-release-notes",
    "--skip-welcome",
  ],
  mocha: {
    ui: "tdd",
    timeout: 60_000,
  },
};

export default defineConfig([
  { ...shared, label: "minimum", version: "1.91.0" },
  { ...shared, label: "stable", version: "stable" },
]);
