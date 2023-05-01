import { test } from '@playwright/test';
import { beforeAllClean } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { sendNewMessage } from './utilities/send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utilities/utils';

const testMessage = 'A -> B: ';
const testReply = 'B -> A: ';

test.beforeEach(beforeAllClean);

// test.afterEach(() => forceCloseAllWindows(windows));

test('Unsend message', async () => {
  // Open App
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
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
