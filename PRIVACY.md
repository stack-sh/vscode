# Privacy

The Stack extension does not collect telemetry, analytics, crash reports, credentials, or document contents.

For language intelligence, the extension launches the user-installed Stack CLI with the fixed `lsp` argument. Open Stack documents and edits travel over standard input and output between the VS Code extension host and that local process. The extension does not send them to Stack services or any other network endpoint.

The `Stack: Open Playground` and documentation commands open a public URL only after the user invokes them. They do not add source text, file paths, workspace identifiers, or other document data to the URL.

Development and release tooling is separate from extension runtime behavior. Integration tests download a checksum-pinned public CLI release, and the release workflow communicates with GitHub and Visual Studio Marketplace to package and publish the extension.

Questions or concerns can be reported through the channels in [SUPPORT.md](./SUPPORT.md). Security-sensitive reports should follow [SECURITY.md](./SECURITY.md).
