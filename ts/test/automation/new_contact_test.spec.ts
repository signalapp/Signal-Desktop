import { _electron, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';

import { sendNewMessage } from './send_message';
import { openAppsAndNewUsers } from './setup/new_user';
import { clickOnTestIdWithText, waitForTestIdWithText } from './utils';

const testMessage = 'A -> B';
const testReply = 'B -> A';
test.beforeEach(cleanUpOtherTest);

let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

// Send message in one to one conversation with new contact
test('Send message to new contact', async () => {
  const windowLoggedIn = await openAppsAndNewUsers(2);
  windows = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [windowA, windowB] = windows;
  const [userA, userB] = users;
  // User A sends message to User B
  await sendNewMessage(windowA, userB.sessionid, `${testMessage}${Date.now()}`);
  // User B sends message to User B to USER A
  await sendNewMessage(windowB, userA.sessionid, `${testReply}${Date.now()}`);
  // Navigate to contacts tab in User B's window

  await clickOnTestIdWithText(windowA, 'contact-section');
  await windowA.waitForTimeout(2000);
  await waitForTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);

  // Navigate to contacts tab in User A's window
  await clickOnTestIdWithText(windowA, 'contact-section');
});
