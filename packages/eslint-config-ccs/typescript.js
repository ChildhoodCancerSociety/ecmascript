/**
 * @type {import("eslint/lib/shared/types").ConfigData}
 */
module.exports = {
  plugins: [
    "@typescript-eslint/eslint-plugin",
    "eslint-plugin-import"
  ],
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:import/typescript",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: "./"
  },
  rules: {
    "@typescript-eslint/ban-ts-comment": 0,
    "@typescript-eslint/ban-types": [
      "error",
      {
        types: {
          Function: false // we use class decorators. sue me
        },
        extendDefaults: true,
      }
    ],
  },
  settings: {
    "import/resolver": {
      typescript: {
        project: [
          "./tsconfig.json"
        ]
      },
      node: {
      },
    }
  }
};
