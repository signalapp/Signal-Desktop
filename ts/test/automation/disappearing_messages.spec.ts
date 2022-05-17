import { _electron, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { messageSent } from './message';
import { openAppsAndNewUsers } from './setup/new_user';
import { sendNewMessage } from './send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForMatchingText,
  waitForReadableMessageWithText,
  waitForTestIdWithText,
} from './utils';

test.beforeEach(cleanUpOtherTest);
let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

const testMessage = 'Test-Message- (A -> B) ';
const testReply = 'Reply-Test-Message- (B -> A)';
const sentMessage = `${testMessage}${Date.now()}`;
const sentReplyMessage = `${testReply} :${Date.now()}`;

test('Disappearing Messages', async () => {
  // Open App
  // Create User
  const windowLoggedIn = await openAppsAndNewUsers(2);
  windows = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [windowA, windowB] = windows;
  const [userA, userB] = users;
  // Create Contact
  await sendNewMessage(windowA, userB.sessionid, sentMessage);
  await sendNewMessage(windowB, userA.sessionid, sentReplyMessage);
  await waitForReadableMessageWithText(windowA, 'Your message request has been accepted');
  // await waitForMatchingText(windowA, `You have accepted ${userA.userName}'s message request`);
  // await waitForMatchingText(windowB, 'Your message request has been accepted');
  // Click on user's avatar to open conversation options
  await clickOnTestIdWithText(windowA, 'conversation-options-avatar');
  // Select disappearing messages drop down
  await clickOnMatchingText(windowA, 'Disappearing messages');
  // Select 5 seconds
  await clickOnMatchingText(windowA, '5 seconds');
  // Click chevron to close menu
  await clickOnTestIdWithText(windowA, 'back-button-conversation-options');
  // Check config message
  await waitForTestIdWithText(
    windowA,
    'readable-message',
    'You set the disappearing message timer to 5 seconds'
  );
  // Check top right hand corner indicator
  await waitForTestIdWithText(windowA, 'disappearing-messages-indicator', '5 seconds');
  // Send message
  // Wait for tick of confirmation
  await messageSent(windowA, sentMessage);
  // Check timer is functioning

  // Verify message is deleted
  const errorDesc = 'Should not be found';
  try {
    const elemShouldNotBeFound = windowA.locator(sentMessage);
    if (elemShouldNotBeFound) {
      console.warn('Sent message not found in window A');
      throw new Error(errorDesc);
    }
  } catch (e) {
    if (e.message !== errorDesc) {
      throw e;
    }
  }
  // Click on user's avatar for options
  await clickOnTestIdWithText(windowA, 'conversation-options-avatar');
  // Click on disappearing messages drop down
  await clickOnMatchingText(windowA, 'Disappearing messages');
  // Select off
  await clickOnMatchingText(windowA, 'Off');
  // Click chevron to close menu
  await clickOnTestIdWithText(windowA, 'back-button-conversation-options');
  // Check config message
  await waitForTestIdWithText(windowA, 'readable-message', 'You disabled disappearing messages.');
  // Verify message is deleted in windowB for receiver user
  // Check config message in windowB
  await waitForMatchingText(
    windowB,
    `${userA.userName} set the disappearing message timer to 5 seconds`
  );
  // Wait 5 seconds
  await waitForMatchingText(windowB, `${userA.userName} disabled disappearing messages`);
  // verify message is deleted in windowB
  const errorDesc2 = 'Should not be found';
  try {
    const elemShouldNotBeFound = windowA.locator(sentMessage);
    if (elemShouldNotBeFound) {
      console.warn('Sent message not found in window B');
      throw new Error(errorDesc2);
    }
  } catch (e) {
    if (e.message !== errorDesc2) {
      throw e;
    }
  }
});
