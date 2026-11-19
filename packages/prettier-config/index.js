/** @type {import("prettier").Config} */
module.exports = {
  semi: true,
  plugins: [require.resolve('@trivago/prettier-plugin-sort-imports')],
  trailingComma: 'es5',
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  printWidth: 100,
  endOfLine: 'auto',
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrder: [
    '^react(.*)$',
    '^next(.*)$',
    '^@tanstack(.*)$',
    '^@supabase(.*)$',
    '<THIRD_PARTY_MODULES>',
    '^@motorismo/(.*)$',
    '^@web/(.*)$',
    '^@tests/(.*)$',
    '^[./]',
  ],
};
