/**
 * @type {import("eslint/lib/shared/types").ConfigData}
 */
module.exports = {
  plugins: [
    "eslint-plugin-prettier"
  ].map(require.resolve),
  extends: [
    "plugin:prettier/recommended"
  ],
  rules: {
    "prettier/prettier": "warn"
  }
};
