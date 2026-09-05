# Stack for Visual Studio Code

Official Visual Studio Code language support for the [Stack architecture diagram language](https://github.com/stack-sh/specification).

The extension associates `.stack` files with Stack, provides the canonical TextMate syntax and editor configuration, and launches the native `stack lsp` process for diagnostics, completion, hover, document symbols, and formatting.

## Requirements

- Visual Studio Code 1.91 or newer.
- Stack CLI `>=0.4.0 <0.6.0` installed in the environment where the workspace extension host runs.
- A trusted workspace. Syntax highlighting remains declarative, but the language server does not start in Restricted Mode because it launches a native executable.

Install the CLI with Homebrew:

```sh
brew install stack-sh/tap/stack
```

See the [CLI distribution contract](https://github.com/stack-sh/cli/blob/main/docs/distribution.md) for supported platforms and other verified installation channels.

## Usage

Open any `.stack` file. The extension starts `stack lsp` automatically and reports its state in the editor's language status area.

Available commands:

- `Stack: Restart Language Server`
- `Stack: Show Language Server Output`
- `Stack: Open Playground`
- `Stack: Open CLI Installation Guide`

If `stack` is not on the extension host's `PATH`, set `stack.server.path` in user or remote settings. The setting is machine-scoped and cannot be supplied by a workspace.

The Playground command opens <https://stack-diagram.com/> in your browser. It does not send the open document or any workspace content.

## Compatibility and updates

| Extension | VS Code    | Stack CLI        | Language assets              |
| --------- | ---------- | ---------------- | ---------------------------- |
| `0.1.x`   | `>=1.91.0` | `>=0.4.0 <0.6.0` | `@stack-sh/language` `0.1.0` |

Update the extension through Visual Studio Code. Update a Homebrew-managed CLI with `brew upgrade stack-sh/tap/stack`; use the owner of any other installation channel to update that installation. The extension refuses to start an older or unverified newer CLI and gives an action appropriate to the detected state.

## Development

```sh
npm ci
npm run check
npm run test:integration
npm run package:check
```

Integration tests download the pinned Stack CLI 0.5.0 release archive for the current supported platform, verify its SHA-256 digest, and run the inspected VSIX contents in clean VS Code 1.91.0 and current stable Extension Development Hosts against the real language server.

See [Releasing](./docs/releasing.md), [Privacy](./PRIVACY.md), [Security](./SECURITY.md), [Support](./SUPPORT.md), and [Third-party notices](./THIRD_PARTY_NOTICES.md).
