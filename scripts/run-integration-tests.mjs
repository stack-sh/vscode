import { spawn } from "node:child_process";

import { prepareIntegrationCli } from "./prepare-integration-cli.mjs";

const executablePath = await prepareIntegrationCli();
const child = spawn("npm", ["run", "test:integration:run"], {
  env: {
    ...process.env,
    STACK_TEST_SERVER_PATH: executablePath,
  },
  stdio: "inherit",
});

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal !== null) {
      reject(new Error(`VS Code integration tests terminated by ${signal}`));
      return;
    }
    resolve(code ?? 1);
  });
});

process.exitCode = exitCode;
