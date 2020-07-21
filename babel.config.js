module.exports = function(api) {
  const isDev = api.env('development')
  const isTest = api.env('test')

  api.cache.using(() => process.env.NODE_ENV)

  const presets = [
    [
      '@babel/env',
      {
        modules: isTest && 'commonjs',
        targets: 'last 2 version, not dead',
        useBuiltIns: 'entry',
        corejs: 2,
      },
    ],
    ['@babel/react', { development: isDev }],
  ]

  const plugins = [
    isDev && 'react-hot-loader/babel',
    ['emotion', { autoLabel: isDev }],
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-export-default-from',
    !isTest && !isDev && 'babel-plugin-transform-react-remove-prop-types',
    !isTest && '@babel/plugin-syntax-dynamic-import',
    isDev && 'babel-plugin-react-docgen',
    isTest && '@babel/plugin-transform-modules-commonjs',
    isTest && 'dynamic-import-node-babel-7',
  ].filter(Boolean)

  return { presets, plugins }
}
