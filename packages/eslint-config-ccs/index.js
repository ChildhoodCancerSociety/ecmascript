/**
 * @type {import("eslint/lib/shared/types").ConfigData}
 */
module.exports = {
  extends: [
    "eslint-config-airbnb-base",
    "./rules/react",
    "./rules/react-a11y",
  ].map(require.resolve),
  rules: {
    // base eslint overrides
    quotes: ["error", "double"],
    "object-curly-newline": 0,
    "no-plusplus": 0,
    "no-underscore-dangle": 0,
    "no-restricted-syntax": 0,
    "global-require": 0,
    "logical-assignment-operators": 0,
    "no-constant-binary-expression": 1,
    "no-empty-static-block": 0,
    "no-new-native-nonconstructor": 1,
    "prefer-object-has-own": 0,

    // eslint-plugin-import rules
    "import/no-extraneous-dependencies": 0,
    "import/prefer-default-export": 0,
    "import/no-dynamic-require": 0,
    "import/no-empty-named-blocks": 1,
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "never",
        jsx: "never",
        ts: "never",
        tsx: "never"
      }
    ],
  },
  ignorePatterns: [
    "**/.eslintrc.js"
  ],
};
