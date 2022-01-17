const config = {
  timeout: 300000,
  globalTimeout: 6000000,
  reporter: 'list',
  testDir: './ts/test/automation',
  testIgnore: '*.js',
  outputDir: './ts/test/automation/test-results',
  use: {
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  workers: 1,
};

module.exports = config;
