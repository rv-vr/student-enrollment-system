import { config as baseConfig } from "@repo/eslint-config/base";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import svelteParser from "svelte-eslint-parser";
import tseslint from "typescript-eslint";

export default [
  ...baseConfig,
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: globals.browser,
    },
    plugins: {
      svelte,
    },
  },
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    ignores: [".svelte-kit/**", "build/**", "dist/**"],
  },
];
