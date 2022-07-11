// tslint:disable-next-line: no-implicit-dependencies
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 350000,
  globalTimeout: 6000000,
  reporter: 'list',
  testDir: './ts/test/automation',
  testIgnore: '*.js',
  outputDir: './ts/test/automation/test-results',
  retries: 0,
  repeatEach: 1,
  workers: 1,
  reportSlowTests: null,
};

module.exports = config;
