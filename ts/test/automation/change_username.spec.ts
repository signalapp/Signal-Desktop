import { _electron, expect, Page, test } from '@playwright/test';
import { newUser } from './setup/new_user';
import { openAppAndWait } from './setup/open';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { clickOnTestIdWithText, typeIntoInput } from './utils';
let window: Page | undefined;

test.beforeEach(cleanUpOtherTest);
test.afterEach(async () => {
  if (window) {
    await forceCloseAllWindows([window]);
  }
});

test('Change username', async () => {
  // Open App
  window = await openAppAndWait('1');
  // Create user
  await newUser(window, 'userA');
  // Open Profile
  await clickOnTestIdWithText(window, 'leftpane-primary-avatar');
  // Click on current username to open edit field
  await clickOnTestIdWithText(window, 'edit-profile-icon');
  // Type in new username
  await typeIntoInput(window, 'profile-name-input', 'new username');
  // await window.fill('.profile-name-input', 'new username');
  // Press enter to confirm username input
  await window.keyboard.press('Enter');
  // Wait for Copy button to appear to verify username change
  await window.isVisible("'Copy'");
  // verify name change
  expect(await window.innerText('[data-testid=your-profile-name]')).toBe('new username');
  // Exit profile module
  await window.click('.session-icon-button.small');
});
