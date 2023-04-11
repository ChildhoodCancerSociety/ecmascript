
/**
 * @type {import("prettier").Config}
 */
module.exports = {
  trailingComma: "es5",
  singleQuote: false,
  printWidth: 80,
  arrowParens: "always",
  useTabs: false,
  tabWidth: 2,
  semi: true,
  bracketSameLine: false,
  plugins: [
    "@trivago/prettier-plugin-sort-imports"
  ],
  importOrder: [
    // prioritize prisma. we use this pretty heavily internally for db so we're including it here
    "^(@prisma/(.*)$)|^(@prisma$)",
    "<THIRD_PARTY_MODULES>",
    // this is usually our `src/` directory alias
    "@\/(.*)$",
    "^[./]"
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  endOfLine: "lf",
}
