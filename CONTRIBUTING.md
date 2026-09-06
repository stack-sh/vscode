# Contributing

Thank you for helping improve Stack for Visual Studio Code.

## Development

Use Node.js 24 or newer and install the exact dependency graph:

```sh
npm ci
```

Run the local quality gates:

```sh
npm run check
npm run test:integration
npm run package:check
npm run audit
```

Integration tests support Apple Silicon and Intel macOS plus arm64 and x86_64 glibc Linux. They download the public Stack CLI 0.5.0 archive for the host, verify its fixed SHA-256 digest, package and inspect the VSIX, and run its extracted contents in VS Code 1.91.0 and current stable with isolated user-data directories.

## Ownership boundaries

- Language syntax, semantics, and portable editor assets belong in [`stack-sh/specification`](https://github.com/stack-sh/specification).
- Compiler diagnostics and language intelligence belong in [`stack-sh/compiler`](https://github.com/stack-sh/compiler).
- LSP transport and native CLI behavior belong in [`stack-sh/cli`](https://github.com/stack-sh/cli).
- This repository owns VS Code registration, lifecycle, guidance, packaging, and Marketplace delivery.

Do not duplicate a parser or grammar in the extension. Consume the versioned public provider artifacts and update compatibility evidence together.

## Pull requests

Keep changes focused, use an English commit and pull request description, add tests for observable behavior, and include the verification commands you ran. Do not commit generated output, VSIX files, downloaded test runtimes, credentials, tokens, customer data, or signing material.
