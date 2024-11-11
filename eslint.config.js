import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import typescriptEslintEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ["dist", "commitlint.config.js", "eslint.config.js"],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslintEslintPlugin,
      "@stylistic": stylistic,
      "simple-import-sort": simpleImportSort,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // https://eslint.org/docs/latest/rules
      quotes: ["warn", "single"],
      indent: [
        "warn",
        2,
        {
          SwitchCase: 1,
        },
      ],
      "linebreak-style": ["warn", "unix"],
      "comma-dangle": ["warn", "always-multiline"],
      "dot-notation": ["warn"],
      eqeqeq: ["warn", "smart"],
      curly: ["warn", "all"],
      "brace-style": ["warn"],
      "prefer-arrow-callback": ["warn"],
      "max-len": ["warn", 140],
      "no-console": ["warn"],
      // https://typescript-eslint.io/rules/
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": ["warn"],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
        },
      ],
      // https://eslint.style/rules
      "@stylistic/semi": ["warn"],
      "@stylistic/member-delimiter-style": ["warn"],
      "@stylistic/comma-spacing": ["warn"],
      "@stylistic/no-multi-spaces": [
        "warn",
        {
          ignoreEOLComments: true,
        },
      ],
      "@stylistic/no-multiple-empty-lines": ["warn", { max: 1 }],
      "@stylistic/no-trailing-spaces": ["warn"],
      "@stylistic/object-curly-spacing": ["warn", "always"],
      "@stylistic/lines-between-class-members": [
        "warn",
        "always",
        {
          exceptAfterSingleLine: true,
        },
      ],
      "@stylistic/eol-last": ["warn", "always"],
      // https://github.com/lydell/eslint-plugin-simple-import-sort
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
];
