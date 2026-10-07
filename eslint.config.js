import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
      "semi": ["error", "always"],
      "quotes": ["error", "double", { "avoidEscape": true }]
    }
  },
  {
    ignores: [
      "node_modules/",
      ".vercel/",
      "coverage/",
      "data/"
    ]
  }
];