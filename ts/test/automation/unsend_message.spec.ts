import { _electron, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { openAppsAndNewUsers } from './setup/new_user';
import { sendNewMessage } from './send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utils';

const testMessage = 'A -> B: ';
const testReply = 'B -> A: ';

test.beforeEach(cleanUpOtherTest);
let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

test('Unsend message', async () => {
  // Open App
  const windowLoggedIn = await openAppsAndNewUsers(2);
  windows = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [windowA, windowB] = windows;
  const [userA, userB] = users;
  // Send message between two users
  await sendNewMessage(windowA, userB.sessionid, `${testMessage}${Date.now()}`);
  await sendNewMessage(windowB, userA.sessionid, `${testReply}${Date.now()}`);
  // Unsend message from User A to User B
  // Right click on message
  await windowA.click('.module-message.module-message--outgoing', { button: 'right' });
  // Select delete for everyone
  await clickOnMatchingText(windowA, 'Delete for everyone');
  // Select delete for everyone confirmation
  await clickOnTestIdWithText(windowA, 'session-confirm-ok-button', 'Delete for everyone');
  // Check that toast notification opens and says 'deleted'
  await waitForTestIdWithText(windowA, 'session-toast', 'Deleted');
  // Check that message is deleted in receivers window
  await waitForMatchingText(windowB, 'This message has been deleted');
});
