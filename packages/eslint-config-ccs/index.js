module.exports = {
  extends: [
    'eslint-config-ccs-base',
    './rules/react',
    './rules/react-a11y',
  ].map(require.resolve),
  rules: {}
};
