module.exports = {
  parserOptions: {
    ecmaVersion: 2017,
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es6: true,
  },
  rules: {
    'no-console': 'off',
  },
};
