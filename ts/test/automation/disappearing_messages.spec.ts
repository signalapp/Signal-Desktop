import { test } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';
import { beforeAllClean } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { sendMessage } from './utilities/message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  hasTextElementBeenDeleted,
  waitForTestIdWithText,
} from './utilities/utils';
import { createContact } from './utilities/create_contact';

test.beforeEach(beforeAllClean);

// test.afterEach(() => forceCloseAllWindows(windows));
// tslint:disable: no-console

const testMessage = 'Test-Message- (A -> B) ';
// const testReply = 'Reply-Test-Message- (B -> A)';
const sentMessage = `${testMessage}${Date.now()}`;
// const sentReplyMessage = `${testReply} :${Date.now()}`;

test('Disappearing messages', async () => {
  // Open App
  // Create User
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  // Create Contact
  await createContact(windowA, windowB, userA, userB);
  // Need to wait for contact approval
  await sleepFor(5000);
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
    'control-message',
    'You set the disappearing message timer to 5 seconds'
  );
  await waitForTestIdWithText(
    windowB,
    'control-message',
    `${userA.userName} set the disappearing message timer to 5 seconds`
  );
  await sleepFor(500);
  // Check top right hand corner indicator
  await waitForTestIdWithText(windowA, 'disappearing-messages-indicator', '5 seconds');
  // Send message
  await sendMessage(windowA, sentMessage);
  // Check timer is functioning
  await sleepFor(6000);
  // Verify message is deleted
  await hasTextElementBeenDeleted(windowA, sentMessage, 3000);
  // focus window B
  await clickOnTestIdWithText(windowB, "control-message", `${userA.userName} set the disappearing message timer to 5 seconds`);
  await hasTextElementBeenDeleted(windowB, sentMessage, 4000);
});
