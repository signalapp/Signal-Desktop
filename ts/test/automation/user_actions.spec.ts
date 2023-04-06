import { _electron, Page, test } from '@playwright/test';
import { beforeAllClean, forceCloseAllWindows } from './setup/beforeEach';

import { sendNewMessage } from './utilities/send_message';
import { openAppsAndNewUsers } from './setup/new_user';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utilities/utils';

let windows: Array<Page> = [];
test.beforeEach(beforeAllClean);

// test.afterEach(() => forceCloseAllWindows(windows));

// Send message in one to one conversation with new contact
test('Create contact', async () => {
  const windowLoggedIn = await openAppsAndNewUsers(2);
  windows = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [windowA, windowB] = windows;
  const [userA, userB] = users;

  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // User A sends message to User B
  await sendNewMessage(windowA, userB.sessionid, `${testMessage} Time: '${Date.now()}'`);
  // User B sends message to User B to USER A
  await sendNewMessage(windowB, userA.sessionid, `${testReply} Time: '${Date.now()}'`);
  // Navigate to contacts tab in User B's window

  await clickOnTestIdWithText(windowA, 'new-conversation-button');
  await windowA.waitForTimeout(2000);
  await waitForTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);

  // Navigate to contacts tab in User A's window
  await clickOnTestIdWithText(windowA, 'new-conversation-button');
});

test('Block User', async () => {
  // Open app and create user
  const windowLoggedIn = await openAppsAndNewUsers(2);
  windows = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [windowA, windowB] = windows;
  const [userA, userB] = users;
  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // Create contact and send new message

  await sendNewMessage(windowA, userB.sessionid, `${testMessage} Time: '${Date.now()}'`);
  await sendNewMessage(windowB, userA.sessionid, `${testReply} Time: '${Date.now()}'`);
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
