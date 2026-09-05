# Support

Use [GitHub Issues](https://github.com/stack-sh/vscode/issues) for reproducible bugs, compatibility problems, and focused feature requests.

Before opening an issue, run these commands in the same local or remote environment where VS Code runs the extension:

```sh
stack --version
stack lsp --help
```

Include:

- Stack extension version.
- VS Code version and local or remote environment.
- Stack CLI version and installation channel.
- Whether the workspace is trusted.
- Relevant output from `Stack: Show Language Server Output`, after removing private paths or document content.
- Minimal reproduction steps and a small non-sensitive Stack example when possible.

Do not include tokens, credentials, private keys, customer data, or proprietary diagrams. Follow [SECURITY.md](./SECURITY.md) for vulnerabilities.
