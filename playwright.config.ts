// tslint:disable-next-line: no-implicit-dependencies
import { PlaywrightTestConfig } from '@playwright/test';
import { toNumber } from 'lodash';

const config: PlaywrightTestConfig = {
  timeout: 350000,
  globalTimeout: 6000000,
  reporter: 'list',
  testDir: './ts/test/automation',
  testIgnore: '*.js',
  outputDir: './ts/test/automation/test-results',
  retries: 1,
  repeatEach: 1,
  workers: toNumber(process.env.PLAYWRIGHT_WORKER_COUNT) || 1,
  reportSlowTests: null,
};

module.exports = config;
