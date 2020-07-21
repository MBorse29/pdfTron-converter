const path = require('path')

module.exports = {
  ...require('./test/jest-common'),
  coverageDirectory: path.join(__dirname, 'coverage'),
  coverageThreshold: {
    global: {
      statements: 25,
      branches: 20,
      lines: 25,
      functions: 25,
    },
    '**/app/utils/*.js': {
      statements: 75,
      branches: 75,
      lines: 75,
      functions: 100,
    },
  },
  coveragePathIgnorePatterns: ['<rootDir>/public', '<rootDir>/node_modules'],
  projects: ['./test/jest.lint.js', './test/jest.client.js'],
}
