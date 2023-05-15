import { test } from '@playwright/test';
import { beforeAllClean } from './setup/beforeEach';
import { openApp } from './setup/open';
import { clickOnMatchingText } from './utilities/utils';

test.beforeEach(beforeAllClean);

test('Tiny test', async () => {
  const [windowA] = await openApp(1);
  await clickOnMatchingText(windowA, 'Create Session ID');
});
