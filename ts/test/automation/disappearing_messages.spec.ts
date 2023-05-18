import { sleepFor } from '../../session/utils/Promise';
import { newUser } from './setup/new_user';
import { sessionTestTwoWindows } from './setup/sessionTest';
import { createContact } from './utilities/create_contact';
import { sendMessage } from './utilities/message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utilities/utils';

// tslint:disable: no-console

const testMessage = 'Test-Message- (A -> B) ';
const sentMessage = `${testMessage}${Date.now()}`;

sessionTestTwoWindows('Disappearing messages', async ([windowA, windowB]) => {
  // Open App
  // Create User
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  // Create Contact
  await createContact(windowA, windowB, userA, userB);
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
  await sleepFor(2000);
  // Check top right hand corner indicator

  await waitForTestIdWithText(windowA, 'disappearing-messages-indicator', '5 seconds');
  // Send message
  // Wait for tick of confirmation
  await sendMessage(windowA, sentMessage);
  // Check timer is functioning

  // Verify message is deleted
  const errorDesc = 'Should not be found';
  try {
    const elemShouldNotBeFound = windowA.locator(sentMessage);
    if (elemShouldNotBeFound) {
      console.error('Sent message not found in window A');
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
  await waitForTestIdWithText(windowA, 'control-message', 'You disabled disappearing messages.');
  // Verify message is deleted in windowB for receiver user
  // Check config message in windowB
  await waitForMatchingText(
    windowB,
    `${userA.userName} set the disappearing message timer to 5 seconds`
  );
  // Wait 5 seconds
  await sleepFor(5000);
  await waitForMatchingText(windowB, `${userA.userName} has turned off disappearing messages.`);
  // verify message is deleted in windowB
  const errorDesc2 = 'Should not be found';
  try {
    const elemShouldNotBeFound = windowA.locator(sentMessage);
    if (elemShouldNotBeFound) {
      console.error('Sent message not found in window B');
      throw new Error(errorDesc2);
    }
  } catch (e) {
    if (e.message !== errorDesc2) {
      throw e;
    }
  }
});
