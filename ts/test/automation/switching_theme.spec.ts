import { expect } from '@playwright/test';
import { newUser } from './setup/new_user';
import { clickOnTestIdWithText } from './utilities/utils';
import { sessionTestOneWindow } from './setup/sessionTest';

sessionTestOneWindow('Switch themes', async ([windowA]) => {
  // Create User
  await newUser(windowA, 'Alice');
  // Check light theme colour is correct
  const darkThemeColor = windowA.locator('.inbox.index');
  await expect(darkThemeColor).toHaveCSS('background-color', 'rgb(27, 27, 27)');

  // Click theme button and change to dark theme
  await clickOnTestIdWithText(windowA, 'theme-section');
  // Check background colour of background to verify dark theme
  const lightThemeColor = windowA.locator('.inbox.index');
  await expect(lightThemeColor).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  // Toggle back to light theme
  await clickOnTestIdWithText(windowA, 'theme-section');
  // Check background colour again
  await expect(darkThemeColor).toHaveCSS('background-color', 'rgb(27, 27, 27)');
});
