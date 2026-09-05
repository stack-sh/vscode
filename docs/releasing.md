# Releasing

Stack extension releases are immutable. A published version is never overwritten; a defect is corrected in a new patch version.

## One-time Marketplace setup

1. Create or verify the Visual Studio Marketplace publisher ID `stack-sh`.
2. Add a trusted publishing policy for GitHub repository `stack-sh/vscode` and workflow `.github/workflows/release.yaml`.
3. Configure any desired approval protection on the repository's `visual-studio-marketplace` environment.

The workflow uses `vsce publish --oidc`. Do not create a `VSCE_PAT` repository secret or commit Marketplace credentials. OIDC must fail closed when the publisher or policy does not match.

## Release preparation

1. Update `version` in `package.json` and regenerate `package-lock.json` with `npm install --package-lock-only`.
2. Move the matching changelog section from `Unreleased` to the release date.
3. Update the compatibility table when the supported VS Code, CLI, or language-asset range changes.
4. Run:

   ```sh
   npm ci
   npm run check
   npm run test:integration
   npm run package:check
   npm run audit
   ```

5. Merge the release pull request after `baseline` succeeds.

## Publish

Create and push an annotated `vMAJOR.MINOR.PATCH` tag on the exact release commit. The tag must equal the package version. The release workflow:

1. installs the locked dependencies on Node.js 24;
2. repeats static, unit, real VS Code/CLI integration, package, and audit gates;
3. creates the versioned, allowlisted VSIX and SHA-256 inventory;
4. attests the VSIX with GitHub OIDC;
5. publishes that exact VSIX to Visual Studio Marketplace with trusted publishing;
6. creates a GitHub Release containing the VSIX and checksum after Marketplace publication succeeds.

Afterward, install the Marketplace version into a clean supported VS Code host, open a `.stack` file, and verify diagnostics, completion, hover, document symbols, formatting, and missing-server guidance. Record the Marketplace URL, GitHub Release, tag, source commit, workflow run, and clean-host result in the release evidence.

If publication fails, do not replace the tag or upload a partial public GitHub Release. Correct the problem, bump the patch version through a new pull request, and publish a new tag.
