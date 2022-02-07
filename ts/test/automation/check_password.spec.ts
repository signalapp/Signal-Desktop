import { _electron, Page, test } from '@playwright/test';
import { newUser } from './new_user';
import { openApp } from './open';
// Open app
let window: Page | undefined;
test('Check Password', async () => {
  // open Electron
  window = await openApp('1');
  // Create user
  await newUser(window, 'userA');
  // Click on settings tab
  await window.click('[data-testid=settings-section]');
  // Click on privacy
  await window.click('"Privacy"');
  // Click set password
  await window.click('"Set Password"');
  // Enter password
  await window.type('#password-modal-input', '123456');
  // Confirm password
  await window.type('#password-modal-input-confirm', '123456');
  // Click OK
  await window.keyboard.press('Enter');
  // Type password into input field
  await window.fill('#password-lock-input', '123456');
  // Click OK
  await window.click('"OK"');
});
