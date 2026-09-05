import {
  commands,
  env,
  LanguageStatusSeverity,
  languages,
  Uri,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type LanguageStatusItem,
  type LogOutputChannel,
} from "vscode";
import {
  LanguageClient,
  RevealOutputChannelOn,
  State,
  type Executable,
  type LanguageClientOptions,
} from "vscode-languageclient/node";

import { probeStackCli, type CliProbeResult } from "./cli-probe";
import { SUPPORTED_STACK_CLI_RANGE } from "./compatibility";

const INSTALLATION_GUIDE = Uri.parse(
  "https://github.com/stack-sh/cli/blob/main/docs/distribution.md",
);
const PLAYGROUND = Uri.parse("https://stack-diagram.com/");
const EXTENSION_RELEASES = Uri.parse(
  "https://github.com/stack-sh/vscode/releases",
);

export type StackServerState =
  | "idle"
  | "checking"
  | "running"
  | "missing"
  | "incompatible"
  | "error"
  | "stopped";

export interface StackServerStatus {
  readonly state: StackServerState;
  readonly executable: string;
  readonly version: string | null;
  readonly detail: string;
}

export interface StackExtensionApi {
  getServerStatus(): StackServerStatus;
  restartLanguageServer(): Promise<void>;
}

let client: LanguageClient | undefined;
let clientStateListener: Disposable | undefined;
let output: LogOutputChannel | undefined;
let languageStatus: LanguageStatusItem | undefined;
let operation = Promise.resolve();
let stopping = false;
let lastNotification: string | undefined;
let serverStatus: StackServerStatus = {
  state: "idle",
  executable: "stack",
  version: null,
  detail: "Open a .stack file to start language intelligence.",
};

export function activate(context: ExtensionContext): StackExtensionApi {
  output = window.createOutputChannel("Stack", { log: true });
  languageStatus = languages.createLanguageStatusItem("stack.languageServer", {
    language: "stack",
  });
  languageStatus.name = "Stack language server";
  languageStatus.accessibilityInformation = {
    label: "Stack language server status",
  };
  updateLanguageStatus(serverStatus);

  context.subscriptions.push(
    output,
    languageStatus,
    commands.registerCommand("stack.restartLanguageServer", () =>
      restartLanguageServer(true),
    ),
    commands.registerCommand("stack.showLanguageServerOutput", () =>
      output?.show(true),
    ),
    commands.registerCommand("stack.openPlayground", () =>
      env.openExternal(PLAYGROUND),
    ),
    commands.registerCommand("stack.openInstallationGuide", () =>
      env.openExternal(INSTALLATION_GUIDE),
    ),
    workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === "stack") {
        void ensureLanguageServer();
      }
    }),
    workspace.onDidCloseTextDocument((document) => {
      if (document.languageId === "stack" && !hasOpenStackDocument()) {
        void stopLanguageServerIfUnused();
      }
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("stack.server.path") &&
        hasOpenStackDocument()
      ) {
        void restartLanguageServer(false);
      }
    }),
  );

  void ensureLanguageServer();

  return {
    getServerStatus: () => ({ ...serverStatus }),
    restartLanguageServer: () => restartLanguageServer(true),
  };
}

export async function deactivate(): Promise<void> {
  await enqueue(async () => {
    await stopLanguageClient();
    setStatus({
      state: "stopped",
      executable: configuredExecutable(),
      version: null,
      detail: "The extension has stopped.",
    });
  });
}

function ensureLanguageServer(): Promise<void> {
  if (
    !hasOpenStackDocument() ||
    serverStatus.state === "checking" ||
    serverStatus.state === "running"
  ) {
    return Promise.resolve();
  }

  return restartLanguageServer(false);
}

function stopLanguageServerIfUnused(): Promise<void> {
  return enqueue(async () => {
    if (hasOpenStackDocument()) {
      return;
    }

    await stopLanguageClient();
    setStatus({
      state: "idle",
      executable: configuredExecutable(),
      version: null,
      detail: "Open a .stack file to start language intelligence.",
    });

    if (hasOpenStackDocument()) {
      void ensureLanguageServer();
    }
  });
}

function restartLanguageServer(notifyOnFailure: boolean): Promise<void> {
  return enqueue(async () => {
    const executable = configuredExecutable();
    const logOutput = output;
    if (logOutput === undefined) {
      return;
    }
    await stopLanguageClient();
    setStatus({
      state: "checking",
      executable,
      version: null,
      detail: `Checking ${executable} --version before launch.`,
    });

    const probe = await probeStackCli(executable);
    if (probe.kind !== "compatible") {
      setProbeFailure(executable, probe);
      if (
        notifyOnFailure ||
        lastNotification !== `${executable}:${probe.kind}`
      ) {
        lastNotification = `${executable}:${probe.kind}`;
        void showProbeGuidance(executable, probe).catch((error: unknown) => {
          output?.warn("Could not present Stack CLI guidance.", error);
        });
      }
      return;
    }

    logOutput.info(`Starting Stack CLI ${probe.version} as a language server.`);
    const workingDirectory = workspace.workspaceFolders?.[0]?.uri.fsPath;
    const executableOptions: Executable = {
      command: executable,
      args: ["lsp"],
      options:
        workingDirectory === undefined
          ? { shell: false }
          : { cwd: workingDirectory, shell: false },
    };
    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { language: "stack", scheme: "file" },
        { language: "stack", scheme: "untitled" },
      ],
      diagnosticCollectionName: "stack",
      outputChannel: logOutput,
      traceOutputChannel: logOutput,
      revealOutputChannelOn: RevealOutputChannelOn.Never,
      progressOnInitialization: true,
      connectionOptions: {
        maxRestartCount: 0,
      },
      markdown: {
        isTrusted: false,
        supportHtml: false,
        supportThemeIcons: false,
      },
      initializationOptions: {
        client: "stack-sh.stack-language",
        supportedCliRange: SUPPORTED_STACK_CLI_RANGE,
      },
    };

    const nextClient = new LanguageClient(
      "stack",
      "Stack Language Server",
      executableOptions,
      clientOptions,
    );
    client = nextClient;
    clientStateListener = nextClient.onDidChangeState((event) => {
      if (client !== nextClient || stopping) {
        return;
      }
      if (
        event.newState === State.StartFailed ||
        event.newState === State.Stopped
      ) {
        setStatus({
          state: "error",
          executable,
          version: probe.version,
          detail:
            "The Stack language server stopped. Open the output or restart it.",
        });
      }
    });

    try {
      await nextClient.start();
      lastNotification = undefined;
      setStatus({
        state: "running",
        executable,
        version: probe.version,
        detail: `Stack CLI ${probe.version} is providing language intelligence.`,
      });
    } catch (error: unknown) {
      output?.error("The Stack language server failed to start.", error);
      if (client === nextClient) {
        client = undefined;
      }
      clientStateListener?.dispose();
      clientStateListener = undefined;
      setStatus({
        state: "error",
        executable,
        version: probe.version,
        detail:
          "The Stack language server failed to start. Open the output for details.",
      });
      if (
        notifyOnFailure ||
        lastNotification !== `${executable}:start-failed`
      ) {
        lastNotification = `${executable}:start-failed`;
        void showStartFailureGuidance().catch((guidanceError: unknown) => {
          output?.warn(
            "Could not present Stack language server guidance.",
            guidanceError,
          );
        });
      }
    }
  });
}

async function showStartFailureGuidance(): Promise<void> {
  const action = await window.showErrorMessage(
    "The Stack language server failed to start. Review the Stack output and restart the server.",
    "Show output",
    "Restart",
  );
  if (action === "Show output") {
    output?.show(true);
  } else if (action === "Restart") {
    void restartLanguageServer(true);
  }
}

function enqueue(task: () => Promise<void>): Promise<void> {
  operation = operation.catch(() => undefined).then(task);
  return operation;
}

async function stopLanguageClient(): Promise<void> {
  const previous = client;
  client = undefined;
  clientStateListener?.dispose();
  clientStateListener = undefined;
  if (previous === undefined) {
    return;
  }

  stopping = true;
  try {
    await previous.stop();
  } catch (error: unknown) {
    output?.warn(
      "The previous Stack language server did not stop cleanly.",
      error,
    );
  } finally {
    stopping = false;
  }
}

function configuredExecutable(): string {
  const inspected = workspace
    .getConfiguration("stack")
    .inspect<string>("server.path");
  const configured =
    inspected?.globalValue ?? inspected?.defaultValue ?? "stack";
  const trimmed = configured.trim();
  return trimmed === "" ? "stack" : trimmed;
}

function hasOpenStackDocument(): boolean {
  return workspace.textDocuments.some(
    (document) => document.languageId === "stack",
  );
}

function setProbeFailure(
  executable: string,
  probe: Exclude<CliProbeResult, { kind: "compatible" }>,
): void {
  if (probe.kind === "missing") {
    setStatus({
      state: "missing",
      executable,
      version: null,
      detail: `Could not find ${executable}. Install Stack CLI or configure stack.server.path.`,
    });
    return;
  }

  if (probe.kind === "too-old" || probe.kind === "too-new") {
    setStatus({
      state: "incompatible",
      executable,
      version: probe.version,
      detail: `Stack CLI ${probe.version} is outside the supported range ${SUPPORTED_STACK_CLI_RANGE}.`,
    });
    return;
  }

  const detail =
    probe.kind === "invalid"
      ? "The configured executable returned an unrecognized version string."
      : `The configured executable could not be checked (${probe.reason}).`;
  setStatus({
    state: "error",
    executable,
    version: null,
    detail,
  });
}

async function showProbeGuidance(
  executable: string,
  probe: Exclude<CliProbeResult, { kind: "compatible" }>,
): Promise<void> {
  if (probe.kind === "missing") {
    const action = await window.showErrorMessage(
      `Stack CLI was not found as "${executable}". Install it or configure stack.server.path in user or remote settings.`,
      "Open installation guide",
      "Configure executable",
    );
    await handleGuidanceAction(action);
    return;
  }

  if (probe.kind === "too-old") {
    const action = await window.showErrorMessage(
      `Stack CLI ${probe.version} is too old. This extension requires ${SUPPORTED_STACK_CLI_RANGE}.`,
      "Open installation guide",
      "Configure executable",
    );
    await handleGuidanceAction(action);
    return;
  }

  if (probe.kind === "too-new") {
    const action = await window.showErrorMessage(
      `Stack CLI ${probe.version} is newer than the verified range ${SUPPORTED_STACK_CLI_RANGE}. Update the extension before starting the server.`,
      "Check extension releases",
      "Configure executable",
    );
    if (action === "Check extension releases") {
      await env.openExternal(EXTENSION_RELEASES);
    } else if (action === "Configure executable") {
      await commands.executeCommand(
        "workbench.action.openSettings",
        "stack.server.path",
      );
    }
    return;
  }

  const action = await window.showErrorMessage(
    probe.kind === "invalid"
      ? "The configured Stack executable returned an unrecognized version. Run `stack --version` in the extension host environment."
      : "The configured Stack executable could not be checked. Review the Stack output and executable setting.",
    "Show output",
    "Configure executable",
  );
  if (action === "Show output") {
    output?.show(true);
  } else if (action === "Configure executable") {
    await commands.executeCommand(
      "workbench.action.openSettings",
      "stack.server.path",
    );
  }
}

async function handleGuidanceAction(action: string | undefined): Promise<void> {
  if (action === "Open installation guide") {
    await env.openExternal(INSTALLATION_GUIDE);
  } else if (action === "Configure executable") {
    await commands.executeCommand(
      "workbench.action.openSettings",
      "stack.server.path",
    );
  }
}

function setStatus(next: StackServerStatus): void {
  serverStatus = next;
  updateLanguageStatus(next);
}

function updateLanguageStatus(status: StackServerStatus): void {
  if (languageStatus === undefined) {
    return;
  }

  languageStatus.busy = status.state === "checking";
  languageStatus.detail = status.detail;
  switch (status.state) {
    case "checking":
      languageStatus.text = "Stack: Starting";
      languageStatus.severity = LanguageStatusSeverity.Information;
      languageStatus.command = undefined;
      break;
    case "running":
      languageStatus.text = `Stack: ${status.version ?? "Ready"}`;
      languageStatus.severity = LanguageStatusSeverity.Information;
      languageStatus.command = {
        command: "stack.showLanguageServerOutput",
        title: "Show Stack Language Server Output",
      };
      break;
    case "missing":
    case "incompatible":
      languageStatus.text = "Stack: Action required";
      languageStatus.severity = LanguageStatusSeverity.Error;
      languageStatus.command = {
        command: "stack.openInstallationGuide",
        title: "Open Stack CLI Installation Guide",
      };
      break;
    case "error":
      languageStatus.text = "Stack: Server error";
      languageStatus.severity = LanguageStatusSeverity.Error;
      languageStatus.command = {
        command: "stack.showLanguageServerOutput",
        title: "Show Stack Language Server Output",
      };
      break;
    case "idle":
    case "stopped":
      languageStatus.text = "Stack: Idle";
      languageStatus.severity = LanguageStatusSeverity.Information;
      languageStatus.command = {
        command: "stack.restartLanguageServer",
        title: "Start Stack Language Server",
      };
      break;
  }
}
