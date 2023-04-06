import { _electron, expect, Page, test } from '@playwright/test';
import { openAppAndWait } from './setup/open';
import { beforeAllClean, forceCloseAllWindows } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { clickOnTestIdWithText, waitForTestIdWithText } from './utilities/utils';
import { sleepFor } from '../../session/utils/Promise';

let window: Page | undefined;
test.beforeEach(beforeAllClean);

test.afterEach(async () => {
  if (window) {
    await forceCloseAllWindows([window]);
  }
});

test('Change profile picture/avatar', async () => {
  window = await openAppAndWait('1');

  await newUser(window, 'userA');
  // Open profile
  await clickOnTestIdWithText(window, 'leftpane-primary-avatar');
  // Click on current profile picture

  await waitForTestIdWithText(window, 'copy-button-profile-update', 'Copy');

  await clickOnTestIdWithText(window, 'image-upload-section');
  await clickOnTestIdWithText(window, 'save-button-profile-update');
  await waitForTestIdWithText(window, 'loading-spinner');

  await waitForTestIdWithText(window, 'copy-button-profile-update', 'Copy');
  await clickOnTestIdWithText(window, 'modal-close-button');

  await sleepFor(500);
  const leftpaneAvatarContainer = await waitForTestIdWithText(window, 'leftpane-primary-avatar');
  await sleepFor(500);
  const screenshot = await leftpaneAvatarContainer.screenshot({
    type: 'jpeg',
    // path: 'avatar-updated-blue',
  });

  expect(screenshot).toMatchSnapshot({ name: 'avatar-updated-blue.jpeg' });
});
