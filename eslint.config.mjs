import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsdoc from "eslint-plugin-jsdoc";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ─── JSDoc enforcement ───
  jsdoc.configs["flat/recommended-typescript"],
  {
    plugins: { jsdoc },
    rules: {
      // Require JSDoc on exported functions / classes / arrow functions
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            MethodDefinition: true,
          },
          publicOnly: true,
          checkConstructors: false,
        },
      ],
      "jsdoc/require-description": ["warn", { checkConstructors: false }],
      // Don't require @param / @returns for TS — types handle that
      "jsdoc/require-param": "off",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-returns-type": "off",
      "jsdoc/tag-lines": "off",
    },
  },

  // ─── Prettier (must be last to turn off conflicting rules) ───
  prettierConfig,

  // ─── Global ignores ───
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**/*.mjs",
    "cypress/**",
    "cypress.config.ts",
  ]),
]);

export default eslintConfig;
