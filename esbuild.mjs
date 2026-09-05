import { build } from "esbuild";

const production = process.argv.includes("--production");

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node20",
  outfile: "dist/extension.js",
  minify: production,
  sourcemap: production ? false : "linked",
  sourcesContent: false,
  legalComments: "none",
  logLevel: "info",
});
