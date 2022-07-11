import { _electron, expect, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { openAppsAndNewUsers } from './setup/new_user';
import { sendNewMessage } from './send_message';
import { clickOnMatchingText, clickOnTestIdWithText, waitForTestIdWithText } from './utils';

test.beforeEach(cleanUpOtherTest);

let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

test('Block User', async () => {
  // Open app and create user
  const windowLoggedIn = await openAppsAndNewUsers(2);
  windows = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [windowA, windowB] = windows;
  const [userA, userB] = users;
  // Create contact and send new message

  await sendNewMessage(windowA, userB.sessionid, `A -> B: ${Date.now()}`);
  await sendNewMessage(windowB, userA.sessionid, `B -> A: ${Date.now()}`);
  // Check to see if User B is a contact
  await clickOnTestIdWithText(windowA, 'contact-section');
  await waitForTestIdWithText(windowA, 'module-conversation__user__profile-name', userB.userName);

  //Click on three dots menu
  await clickOnTestIdWithText(windowA, 'message-section');

  await clickOnTestIdWithText(windowA, 'three-dots-conversation-options');
  // Select block
  await clickOnMatchingText(windowA, 'Block');
  // Verify toast notification 'blocked'
  await waitForTestIdWithText(windowA, 'session-toast', 'Blocked');
  // Verify the user was moved to the blocked contact list
  // Click on settings tab
  await clickOnTestIdWithText(windowA, 'settings-section');
  // Navigate to blocked users tab'
  await clickOnMatchingText(windowA, 'Blocked contacts');
  // Check for user B's name
  const blockedContact = windowA.locator('.session-settings-item__title');

  await expect(blockedContact).toContainText(userB.userName);
  // Unblock user
  await clickOnMatchingText(windowA, 'Unblock');
  // Verify toast notification says unblocked
  await waitForTestIdWithText(windowA, 'session-toast', 'Unblocked');
});
