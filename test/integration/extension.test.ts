import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as vscode from "vscode";

import type { StackExtensionApi } from "../../src/extension";

const EXTENSION_ID = "stack-sh.stack-language";
const SERVER_PATH_SETTING = "server.path";

suite("Stack extension integration", () => {
  let api: StackExtensionApi;
  let cliPath: string;
  const temporaryDirectories: string[] = [];

  suiteSetup(async function () {
    this.timeout(60_000);
    cliPath = process.env.STACK_TEST_SERVER_PATH ?? "";
    assert.notEqual(
      cliPath,
      "",
      "STACK_TEST_SERVER_PATH must name the verified CLI fixture",
    );

    await vscode.workspace
      .getConfiguration("stack")
      .update(SERVER_PATH_SETTING, cliPath, vscode.ConfigurationTarget.Global);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, "the integration workspace must be open");
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(join(workspaceFolder.uri.fsPath, "diagram.stack")),
    );
    await vscode.window.showTextDocument(document);

    const extension =
      vscode.extensions.getExtension<StackExtensionApi>(EXTENSION_ID);
    assert.ok(
      extension,
      `${EXTENSION_ID} must be installed in the extension host`,
    );
    api = await extension.activate();
    await waitFor(() => api.getServerStatus().state === "running");
  });

  suiteTeardown(async () => {
    await vscode.workspace
      .getConfiguration("stack")
      .update(
        SERVER_PATH_SETTING,
        undefined,
        vscode.ConfigurationTarget.Global,
      );
    await Promise.all(
      temporaryDirectories.map((directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
    );
  });

  test("registers .stack files and starts the verified native server", () => {
    const document = vscode.window.activeTextEditor?.document;
    assert.ok(document);
    assert.equal(document.languageId, "stack");
    assert.deepEqual(api.getServerStatus(), {
      state: "running",
      executable: cliPath,
      version: process.env.STACK_TEST_CLI_VERSION ?? "0.5.0",
      detail: `Stack CLI ${process.env.STACK_TEST_CLI_VERSION ?? "0.5.0"} is providing language intelligence.`,
    });
  });

  test("provides completion, hover, symbols, and formatting through LSP", async () => {
    const completionDocument = await vscode.workspace.openTextDocument({
      language: "stack",
      content: 'stack 1.0\n\ndiagram "Completion" {\n  no\n}\n',
    });
    await vscode.window.showTextDocument(completionDocument);
    const completions =
      await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        completionDocument.uri,
        new vscode.Position(3, 4),
      );
    assert.ok(
      completions.items.some((item) => completionLabel(item) === "node"),
    );

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    const diagramUri = vscode.Uri.file(
      join(workspaceFolder.uri.fsPath, "diagram.stack"),
    );
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      diagramUri,
      new vscode.Position(3, 8),
    );
    assert.ok(hovers.some((hover) => hover.contents.length > 0));

    const symbols = await vscode.commands.executeCommand<
      Array<vscode.DocumentSymbol | vscode.SymbolInformation>
    >("vscode.executeDocumentSymbolProvider", diagramUri);
    assert.ok(countDocumentSymbols(symbols) >= 3);

    const formatDocument = await vscode.workspace.openTextDocument({
      language: "stack",
      content: 'stack 1.0\ndiagram "Format" { node api "API" }\n',
    });
    await vscode.window.showTextDocument(formatDocument);
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      "vscode.executeFormatDocumentProvider",
      formatDocument.uri,
      { insertSpaces: true, tabSize: 2 },
    );
    assert.ok(edits.length > 0);
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(formatDocument.uri, edits);
    assert.equal(await vscode.workspace.applyEdit(workspaceEdit), true);
    assert.equal(
      formatDocument.getText(),
      'stack 1.0\n\ndiagram "Format" {\n  node api "API"\n}\n',
    );
  });

  test("publishes diagnostics for the current document", async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);
    const uri = vscode.Uri.file(
      join(workspaceFolder.uri.fsPath, "invalid.stack"),
    );
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    await waitFor(() => vscode.languages.getDiagnostics(uri).length > 0);

    const diagnostics = vscode.languages.getDiagnostics(uri);
    assert.ok(
      diagnostics.some(
        (diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error,
      ),
    );
    assert.ok(diagnostics.every((diagnostic) => diagnostic.source === "stack"));
  });

  test("surfaces a missing executable as an actionable state", async () => {
    const missingPath = join(process.cwd(), "missing stack cli");
    await vscode.workspace
      .getConfiguration("stack")
      .update(
        SERVER_PATH_SETTING,
        missingPath,
        vscode.ConfigurationTarget.Global,
      );
    await api.restartLanguageServer();
    assert.equal(api.getServerStatus().state, "missing");
    assert.equal(api.getServerStatus().executable, missingPath);

    await vscode.workspace
      .getConfiguration("stack")
      .update(SERVER_PATH_SETTING, cliPath, vscode.ConfigurationTarget.Global);
    await api.restartLanguageServer();
    await waitFor(() => api.getServerStatus().state === "running");
  });

  test("refuses older and unverified newer CLI versions", async () => {
    for (const version of ["0.3.9", "0.6.0"]) {
      const executable = await createVersionFixture(version);
      await vscode.workspace
        .getConfiguration("stack")
        .update(
          SERVER_PATH_SETTING,
          executable,
          vscode.ConfigurationTarget.Global,
        );
      await api.restartLanguageServer();
      assert.deepEqual(api.getServerStatus(), {
        state: "incompatible",
        executable,
        version,
        detail: `Stack CLI ${version} is outside the supported range >=0.4.0 <0.6.0.`,
      });
    }

    await vscode.workspace
      .getConfiguration("stack")
      .update(SERVER_PATH_SETTING, cliPath, vscode.ConfigurationTarget.Global);
    await api.restartLanguageServer();
    await waitFor(() => api.getServerStatus().state === "running");
  });

  async function createVersionFixture(version: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "stack incompatible cli "));
    temporaryDirectories.push(directory);
    const executable = join(directory, "stack");
    await writeFile(
      executable,
      `#!/bin/sh\nprintf 'stack ${version}\\n'\n`,
      "utf8",
    );
    await chmod(executable, 0o755);
    return executable;
  }
});

function completionLabel(item: vscode.CompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

function countDocumentSymbols(
  symbols: ReadonlyArray<vscode.DocumentSymbol | vscode.SymbolInformation>,
): number {
  return symbols.reduce((count, symbol) => {
    if ("children" in symbol) {
      return count + 1 + countDocumentSymbols(symbol.children);
    }
    return count + 1;
  }, 0);
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 20_000,
): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for the Stack extension state");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
