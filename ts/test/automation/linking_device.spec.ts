import { _electron, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { linkedDevice } from './setup/linked_device';
import { clickOnTestIdWithText, typeIntoInput, waitForTestIdWithText } from './utils';

test.beforeEach(cleanUpOtherTest);

const windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

test('linking device', async () => {
  const { windowA1, windowA2, userA } = await linkedDevice();
  windows.push(windowA1, windowA2);

  await clickOnTestIdWithText(windowA2, 'leftpane-primary-avatar');
  // Verify Username
  await waitForTestIdWithText(windowA2, 'your-profile-name', userA.userName);
  // Verify Session ID
  await waitForTestIdWithText(windowA2, 'your-session-id', userA.sessionid);
  // exit profile module
  await clickOnTestIdWithText(windowA2, 'modal-close-button');
  // You're almost finished isn't displayed
  const errorDesc = 'Should not be found';
  try {
    const elemShouldNotBeFound = windowA2.locator('[data-testid=reveal-recovery-phrase]');
    if (elemShouldNotBeFound) {
      console.warn('Element not found');
      throw new Error(errorDesc);
    }
  } catch (e) {
    if (e.message !== errorDesc) {
      // this is NOT ok
      throw e;
    }
  }
  await clickOnTestIdWithText(windowA1, 'leftpane-primary-avatar');
  // Click on pencil icon
  await clickOnTestIdWithText(windowA1, 'edit-profile-icon');
  // Replace old username with new username
  const newUsername = 'new-username';
  await typeIntoInput(windowA1, 'profile-name-input', newUsername);
  // Press enter to confirm change
  await windowA1.keyboard.press('Enter');
  // Wait for loading animation
  // Check username change in window B2
  // Click on profile settings in window B
  await clickOnTestIdWithText(windowA2, 'leftpane-primary-avatar');
  // Verify username has changed to new username
  await waitForTestIdWithText(windowA2, 'your-profile-name', userA.userName);
  // Check message is deleting on both devices
});
