const PORT = process.env.PORT || 3000
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const path = require('path')
const Webpack = require('webpack')
const wpConfig = require('../webpack.dev.js')
const fs = require('fs')
var cors = require('cors')

const app = express()
const compiler = Webpack(wpConfig)

// body content handling
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(cors())

// Set up webpack dev server middleware
const WebpackMiddleware = require('webpack-dev-middleware')(compiler, {
  port: 3000,
  hot: true,
  publicPath: wpConfig.output.publicPath,
  writeToDisk: true,
  contentBase: path.resolve(__dirname, './public'),
  stats: {
    modules: false,
    chunks: false,
    timings: false,
    children: false,
    cachedAssets: false,
    publicPath: false,
    hash: false,
    colors: true,
  },
})

app.use(WebpackMiddleware)
app.use(require('webpack-hot-middleware')(compiler))

function parseConditionals(str, data) {
  return str.replace(
    /({{#if (\w+)}})([^]+)({{\/if}})/gm,
    (match, p1, p2, p3) => {
      if (data[p2]) return p3
      return ''
    },
  )
}

WebpackMiddleware.waitUntilValid(() => {
  // app.get('/products/:id', function (req, res, next) {
  //   res.json({msg: 'This is CORS-enabled for all origins!'})
  // })

  app.get('*', cors(), (req, res) => {
    // handling for static files in dev server
    if (
      /.(png|ico|xml|json|js|pdf)$/.test(req.path) ||
      req.path.indexOf('/WebViewer/lib/') !== -1
    ) {
      res.sendFile(path.resolve(__dirname, `../public${req.path}`))
    } else {
      const cookies = req.cookies
      const locale = cookies.I18N_MOCK || 'en_US'

      const settings = {
        langfile: locale !== 'en_US',
        PATH_PREFIX: '',
        CLIENT_PATH: '',
        locale,
        locale_data: JSON.stringify({
          currency: 'USD',
          locale,
        }),
      }

      fs.readFile(
        path.resolve(__dirname, '../public/index.html'),
        'utf8',
        (err, data) => {
          if (err) {
            return err
          }
          const response = Object.keys(settings).reduce((str, key) => {
            const regex = new RegExp(`{{ ${key} }}`, 'gm')
            return str.replace(regex, settings[key])
          }, data)

          res.send(parseConditionals(response, settings))
        },
      )
    }
  })

  app.listen(PORT, () => console.log('Listening on port %s', PORT))
})
