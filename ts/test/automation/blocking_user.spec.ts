import { _electron, Page, test } from '@playwright/test';
import { beforeAllClean, forceCloseAllWindows } from './setup/beforeEach';
import { openAppsAndNewUsers } from './setup/new_user';
import { sendNewMessage } from './send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utils';

let windows: Array<Page> = [];
test.beforeEach(beforeAllClean);

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
  await clickOnTestIdWithText(windowA, 'new-conversation-button');
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

  // click on settings section 'conversation'
  await clickOnTestIdWithText(windowA, 'conversations-settings-menu-item');

  // Navigate to blocked users tab'
  await clickOnTestIdWithText(windowA, 'reveal-blocked-user-settings');
  // select the contact to unblock by clicking on it by name
  await clickOnMatchingText(windowA, userB.userName);

  // Unblock user by clicking on unblock
  await clickOnTestIdWithText(windowA, 'unblock-button-settings-screen');
  // Verify toast notification says unblocked
  await waitForTestIdWithText(windowA, 'session-toast', 'Unblocked');
  await waitForMatchingText(windowA, 'No blocked contacts');
});
