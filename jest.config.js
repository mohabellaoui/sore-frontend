// jest.config.js — sore-frontend. index.html is a single inline-script app
// (no bundler, no modules). Tests extract specific sections of that script
// by source markers and evaluate them in a jsdom sandbox — see
// __tests__/helpers/loadPlaybookRunner.js.
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  verbose: true,
};
