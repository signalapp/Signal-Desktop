import { _electron, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { openAppAndWait } from './setup/open';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utils';
let window: Page | undefined;

test.beforeEach(cleanUpOtherTest);
test.afterEach(async () => {
  if (window) {
    await forceCloseAllWindows([window]);
  }
});

const testPassword = '123456';
const newTestPassword = '789101112';

test.describe('Password checks', () => {
  test('Set Password', async () => {
    // open Electron
    window = await openAppAndWait('1');
    // Create user
    await newUser(window, 'userA');
    // Click on settings tab
    await clickOnTestIdWithText(window, 'settings-section');
    // Click on privacy
    await clickOnTestIdWithText(window, 'privacy-settings-menu-item');
    // Click set password
    await clickOnTestIdWithText(window, 'set-password-button');
    // Enter password
    await typeIntoInput(window, 'password-input', testPassword);
    await window.keyboard.press('Delete');
    // Confirm password
    await typeIntoInput(window, 'password-input-confirm', testPassword);
    await window.keyboard.press('Delete');
    // Click OK
    await clickOnMatchingText(window, 'OK');
    // await window.keyboard.press('Enter');
    // Check toast notification
    await waitForTestIdWithText(
      window,
      'session-toast',
      'Your password has been set. Please keep it safe'
    );
    // Type password into input field

    await typeIntoInput(window, 'password-lock-input', testPassword);
    // Click OK
    await clickOnMatchingText(window, 'OK');
    // Change password
    await clickOnMatchingText(window, 'Change Password');
    // Enter old password
    await typeIntoInput(window, 'password-input', testPassword);
    await window.keyboard.press('Delete');
    // Enter new password
    await typeIntoInput(window, 'password-input-confirm', newTestPassword);
    await window.keyboard.press('Delete');
    // await window.fill('#password-modal-input-confirm', newTestPassword);
    await window.keyboard.press('Tab');
    // Confirm new password
    await typeIntoInput(window, 'password-input-reconfirm', newTestPassword);
    await window.keyboard.press('Delete');
    // await window.fill('#password-modal-input-reconfirm', newTestPassword);
    // Press enter on keyboard
    await window.keyboard.press('Enter');
    // Select OK
    await clickOnMatchingText(window, 'OK');
    // Check toast notification for 'changed password'
    await waitForTestIdWithText(
      window,
      'session-toast',
      'Your password has been changed. Please keep it safe.'
    );
  });
  test('Wrong password', async () => {
    // Check if incorrect password works
    window = await openAppAndWait('1');
    // Create user
    await newUser(window, 'userA');
    // Click on settings tab
    await clickOnTestIdWithText(window, 'settings-section');
    // Click on privacy
    await clickOnMatchingText(window, 'Privacy');
    // Click set password
    await clickOnMatchingText(window, 'Set Password');
    // Enter password
    await typeIntoInput(window, 'password-input', testPassword);
    await window.keyboard.press('Delete');
    // Confirm password
    await typeIntoInput(window, 'password-input-confirm', testPassword);
    await window.keyboard.press('Delete');
    // Click OK
    await window.keyboard.press('Enter');
    // Type password into input field
    await typeIntoInput(window, 'password-lock-input', testPassword);
    await window.keyboard.press('Delete');
    // Click OK
    await clickOnMatchingText(window, 'OK');
    // Navigate away from settings tab
    await clickOnTestIdWithText(window, 'message-section');
    // // Click on settings tab
    await clickOnTestIdWithText(window, 'settings-section');
    // // Try with incorrect password
    await typeIntoInput(window, 'password-lock-input', '0000');
    await window.keyboard.press('Delete');
    // Confirm
    await clickOnMatchingText(window, 'OK');
    // // invalid password banner showing?
    await waitForMatchingText(window, 'Invalid password');
    // // Empty password
    // // Navigate away from settings tab
    await clickOnTestIdWithText(window, 'message-section');
    // // Click on settings tab
    await clickOnTestIdWithText(window, 'settings-section');
    // // No password entered
    await clickOnMatchingText(window, 'OK');
    // // Banner should ask for password to be entered
    await waitForMatchingText(window, 'Please enter your password');
  });
});
