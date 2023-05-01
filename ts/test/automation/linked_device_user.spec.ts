import { _electron, Page, test } from '@playwright/test';
import { beforeAllClean, forceCloseAllWindows } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { linkedDevice } from './utilities/linked_device';
import { clickOnTestIdWithText, typeIntoInput, waitForTestIdWithText } from './utilities/utils';

const windows: Array<Page> = [];
test.beforeEach(beforeAllClean);

test.afterEach(() => forceCloseAllWindows(windows));
// tslint:disable: no-console

test('Link a device', async () => {
  const [windowA] = await openApp(1);
  const userA = await newUser(windowA, 'Alice');
  const [windowB] = await linkedDevice(userA.recoveryPhrase);
  const newUsername = 'Tiny bubble';
  await clickOnTestIdWithText(windowA, 'leftpane-primary-avatar');
  // Verify Username
  await waitForTestIdWithText(windowA, 'your-profile-name', userA.userName);
  // Verify Session ID
  await waitForTestIdWithText(windowA, 'your-session-id', userA.sessionid);
  // exit profile module
  await clickOnTestIdWithText(windowA, 'modal-close-button');
  // You're almost finished isn't displayed
  const errorDesc = 'Should not be found';
  try {
    const elemShouldNotBeFound = windowB.locator('[data-testid=reveal-recovery-phrase]');
    if (elemShouldNotBeFound) {
      console.error('Element not found');
      throw new Error(errorDesc);
    }
  } catch (e) {
    if (e.message !== errorDesc) {
      // this is NOT ok
      throw e;
    }
  }
  await clickOnTestIdWithText(windowA, 'leftpane-primary-avatar');
  // Click on pencil icon
  await clickOnTestIdWithText(windowA, 'edit-profile-icon');
  // Replace old username with new username
  await typeIntoInput(windowA, 'profile-name-input', newUsername);
  // Press enter to confirm change
  await windowA.keyboard.press('Enter');
  // Wait for loading animation
  // Check username change in window B2
  // Click on profile settings in window B
  await clickOnTestIdWithText(windowB, 'leftpane-primary-avatar');
  // Verify username has changed to new username
  await waitForTestIdWithText(windowB, 'your-profile-name', newUsername);
  // Check message is deleting on both devices
});
