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
    "comma-dangle": 0,
    "global-require": 0,
    "logical-assignment-operators": 0,
    "no-constant-binary-expression": 1,
    "no-empty-static-block": 0,
    "no-labels": 0,
    "no-new-native-nonconstructor": 1,
    "no-plusplus": 0,
    "no-restricted-syntax": 0,
    "no-shadow": 0,
    "no-underscore-dangle": 0,
    "object-curly-newline": 0,
    "prefer-object-has-own": 0,

    // eslint-plugin-import rules
    "import/no-absolute-path": 0,
    "import/no-dynamic-require": 0,
    "import/no-empty-named-blocks": 1,
    "import/no-extraneous-dependencies": 0,
    "import/no-unresolved": 0,
    "import/prefer-default-export": 0,
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

    // add react rules
    "react/react-in-jsx-scope": 0,
    "react/jsx-filename-extension": 0,
    "react/require-default-props": 0,
    "react/jsx-props-no-spreading": 0,
    "react/button-has-type": 0,
    "react/prop-types": 0,
    "react/function-component-definition": [2, {
      "namedComponents": "arrow-function"
    }]
  },
  ignorePatterns: [
    "**/.eslintrc.js"
  ],
};
