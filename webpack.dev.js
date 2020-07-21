const CleanWebpackPlugin = require('clean-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const ProgressBarPlugin = require('progress-bar-webpack-plugin')
const path = require('path')
const webpack = require('webpack')
// require('babel-polyfill')

const getLocaleHash = () => {
  return (
    Math.random()
      .toString(36)
      .substring(2, 15) +
    Math.random()
      .toString(36)
      .substring(2, 15)
  )
}

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    client: [
      // 'babel-polyfill',
      // 'webpack-hot-middleware/client',
      'webpack/hot/only-dev-server',
      path.resolve(__dirname, './app/client'),
    ],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules\/.*/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              rootMode: 'upward',
            },
          },
          { loader: 'eslint-loader' },
        ],
      },
      {
        test: /\.(?:png|ttf|woff|svg)$/,
        use: {
          loader: 'url-loader',
          options: { limit: 100000 },
        },
      },
      {
        test: /\.(pdf|gif|png|jpe?g|svg)$/,
        use: 'file-loader?name=[path][name].[ext]',
      },
    ],
  },
  output: {
    path: path.resolve(__dirname, './public/build/'),
    filename: '[name].[hash].js',
    publicPath: '/',
    chunkFilename:
      process.env.NODE_ENV === 'development'
        ? '[name].chunk.js'
        : '[name].[hash].js',
    globalObject: 'this',
  },
  plugins: [
    new CleanWebpackPlugin([path.resolve(__dirname, './public/build')], {
      verbose: true,
    }),
    new HtmlWebpackPlugin({
      template: './public/template.ejs',
      filename: path.resolve(__dirname, './public/index.html'),
      inject: 'body',
      localeHash: getLocaleHash(),
    }),
    new webpack.HotModuleReplacementPlugin(),
    new ProgressBarPlugin({
      clear: false,
      width: 30,
      format: ' build [:bar] :percent  ',
    }),
  ],
  resolve: {
    symlinks: false,
    extensions: ['.js', '.jsx', '.json'],
    modules: ['node_modules'],
    alias: {
      'react-dom': '@hot-loader/react-dom',
    },
  },
}
