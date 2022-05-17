import { _electron, Page, test } from '@playwright/test';
import { sendNewMessage } from './send_message';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { openAppsAndNewUsers } from './setup/new_user';
import { clickOnTestIdWithText, waitForMatchingText, waitForTestIdWithText } from './utils';

const testMessage = 'A -> B';
test.beforeEach(cleanUpOtherTest);

let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));
// Open two windows and log into 2 separate accounts
test.describe('Message requests', () => {
  test('Message request acceptance', async () => {
    const windowLoggedIn = await openAppsAndNewUsers(2);
    windows = windowLoggedIn.windows;
    const users = windowLoggedIn.users;
    const [windowA, windowB] = windows;
    const [userA, userB] = users;
    // send a message to User B from User A
    await sendNewMessage(windowA, userB.sessionid, `${testMessage}${Date.now()}`);
    // Check the message request banner appears and click on it
    await clickOnTestIdWithText(windowB, 'message-request-banner');
    // Select message request from User A
    await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);
    // Check that using the accept button has intended use
    await clickOnTestIdWithText(windowB, 'accept-message-request');
    // Check config message of message request acceptance
    await waitForTestIdWithText(
      windowB,
      'readable-message',
      `You have accepted ${userA.userName}'s message request`
    );
    await waitForMatchingText(windowB, 'No pending message requests');
  });
  test('Message request rejection', async () => {
    const windowLoggedIn = await openAppsAndNewUsers(2);
    windows = windowLoggedIn.windows;
    const users = windowLoggedIn.users;
    const [windowA, windowB] = windows;
    const [userA, userB] = users;
    // send a message to User B from User A
    await sendNewMessage(windowA, userB.sessionid, `${testMessage}${Date.now()}`);
    // Check the message request banner appears and click on it
    await clickOnTestIdWithText(windowB, 'message-request-banner');
    // Select message request from User A
    await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);
    // Check that using the accept button has intended use
    await clickOnTestIdWithText(windowB, 'decline-message-request');
    // Confirm decline
    await clickOnTestIdWithText(windowB, 'session-confirm-ok-button', 'Decline');
    // Check config message of message request acceptance
    await waitForTestIdWithText(windowB, 'session-toast', 'Blocked');
    await waitForMatchingText(windowB, 'No pending message requests');
  });
});
