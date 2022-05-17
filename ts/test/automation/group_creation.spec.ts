import { _electron, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { messageSent } from './message';
import { openAppsAndNewUsers } from './setup/new_user';
import { sendNewMessage } from './send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  waitForReadableMessageWithText,
  waitForTestIdWithText,
} from './utils';

const testGroupName = 'Test Group Name';

test.beforeEach(cleanUpOtherTest);

let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

test('Create group', async () => {
  const windowLoggedIn = await openAppsAndNewUsers(3);
  windows = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [windowA, windowB, windowC] = windows;
  const [userA, userB, userC] = users;
  // Add contacts
  await sendNewMessage(windowA, userC.sessionid, `A -> C: ${Date.now()}`);
  await Promise.all([
    sendNewMessage(windowA, userB.sessionid, `A -> B: ${Date.now()}`),
    sendNewMessage(windowB, userA.sessionid, `B -> A: ${Date.now()}`),
    sendNewMessage(windowC, userA.sessionid, `C -> A: ${Date.now()}`),
  ]);
  // Click new closed group tab
  await clickOnMatchingText(windowA, 'New Closed Group');
  // Enter group name
  await typeIntoInput(windowA, 'new-closed-group-name', testGroupName);
  // Select user B
  await clickOnMatchingText(windowA, userB.userName);
  // Select user C
  await clickOnMatchingText(windowA, userC.userName);
  // Click Done
  await clickOnMatchingText(windowA, 'Done');
  // Check group was successfully created
  await clickOnMatchingText(windowB, testGroupName);
  await waitForTestIdWithText(windowB, 'header-conversation-name', testGroupName);
  // Send message in group chat from user A
  const msgAToGroup = 'A -> Group';
  await messageSent(windowA, msgAToGroup);
  // Verify it was received by other two accounts
  // Navigate to group in window B
  await clickOnTestIdWithText(windowB, 'message-section');
  // Click on test group
  await clickOnMatchingText(windowB, testGroupName);
  // wait for selector 'test message' in chat window
  await waitForReadableMessageWithText(windowB, msgAToGroup);
  // Send reply message
  const msgBToGroup = 'B -> Group';
  await messageSent(windowB, msgBToGroup);
  // Navigate to group in window C
  await clickOnTestIdWithText(windowC, 'message-section');
  // Click on test group
  await clickOnMatchingText(windowC, testGroupName);
  // windowC must see the message from A
  await waitForReadableMessageWithText(windowC, msgAToGroup);
  // windowC must see the message from B
  await waitForReadableMessageWithText(windowC, msgBToGroup);
  // Send message from C to the group
  const msgCToGroup = 'C -> Group';
  await messageSent(windowC, msgCToGroup);
  // windowA should see the message from B and the message from C
  await waitForReadableMessageWithText(windowA, msgBToGroup);
  await waitForReadableMessageWithText(windowA, msgCToGroup);
});
