/**
 * @type {import("eslint/lib/shared/types").ConfigData}
 */
module.exports = {
  plugins: [
    "eslint-plugin-prettier"
  ],
  extends: [
    "plugin:prettier/recommended"
  ],
  rules: {
    "prettier/prettier": "warn"
  }
};
