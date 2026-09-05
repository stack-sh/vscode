import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const typedFiles = ["src/**/*.ts", "test/**/*.ts"];

export default tseslint.config(
  {
    ignores: [
      ".test-bin/**",
      ".test-vsix/**",
      ".vscode-test/**",
      "artifacts/**",
      "dist/**",
      "language-configuration.json",
      "node_modules/**",
      "out-test/**",
      "syntaxes/**",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typedFiles,
  })),
  {
    files: typedFiles,
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
);
