import { _electron, expect, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { openAppsAndNewUsers } from './setup/new_user';
import { clickOnTestIdWithText } from './utils';

test.beforeEach(cleanUpOtherTest);
let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

test('Switch themes', async () => {
  // Open App
  // Create User
  const windowLoggedIn = await openAppsAndNewUsers(1);
  windows = windowLoggedIn.windows;
  const [windowA] = windows;
  // Check light theme colour is correct
  const lightThemeColor = windowA.locator('.inbox.index');
  await expect(lightThemeColor).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  // Click theme button and change to dark theme
  await clickOnTestIdWithText(windowA, 'theme-section');
  // Check background colour of background to verify dark theme
  const darkThemeColor = windowA.locator('.inbox.index');
  await expect(darkThemeColor).toHaveCSS('background-color', 'rgb(23, 23, 23)');
  // Toggle back to light theme
  await clickOnTestIdWithText(windowA, 'theme-section');
  // Check background colour again
  await expect(lightThemeColor).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
