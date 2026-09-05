# Security policy

## Supported versions

Security fixes are provided for the latest published minor line. Before the first Marketplace release, the `main` branch is the only supported development version.

| Version  | Supported |
| -------- | --------- |
| `0.1.x`  | Yes       |
| `<0.1.0` | No        |

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/stack-sh/vscode/security/advisories/new). Do not open a public issue for a suspected vulnerability or include secrets, private Stack files, or customer data in an issue.

Include the extension version, VS Code version, operating environment, Stack CLI version, impact, and minimal reproduction steps. We will acknowledge the report, investigate it, and coordinate disclosure and a patched release when appropriate.

## Runtime boundary

- The extension is disabled in untrusted workspaces because it launches a native process.
- `stack.server.path` is machine-scoped, so workspace files cannot replace the executable path.
- The configured executable is started without a shell and receives only the fixed `lsp` argument.
- The executable must report a version in the extension's documented compatibility range before it is launched as a language server.
- Document contents remain on the extension host and are sent only to the local `stack lsp` process over standard input and output.
- The extension does not collect telemetry or runtime credentials.

Dependencies and the installable VSIX are audited and inspected in CI. GitHub Actions are pinned by commit, and Marketplace publishing uses a short-lived OpenID Connect credential instead of a repository secret.
