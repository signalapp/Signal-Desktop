import { sleepFor } from '../../session/utils/Promise';
import { newUser } from './setup/new_user';
import { sessionTestTwoWindows } from './setup/sessionTest';
import { createContact } from './utilities/create_contact';
import { sendMessage } from './utilities/message';
import {
  clickOnTestIdWithText,
  hasTextElementBeenDeleted,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utilities/utils';

const testMessage = 'Test-Message- (A -> B) ';
const sentMessage = `${testMessage}${Date.now()}`;

sessionTestTwoWindows('Disappearing messages', async ([windowA, windowB]) => {
  // Open App
  // Create User
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  // Create Contact
  await createContact(windowA, windowB, userA, userB);
  // Need to wait for contact approval
  await sleepFor(5000);
  // Click on user's avatar to open conversation options
  await clickOnTestIdWithText(windowA, 'conversation-options-avatar');
  await waitForMatchingText(windowA, 'Your message request has been accepted');
  // Select disappearing messages drop down
  await clickOnTestIdWithText(windowA, 'disappearing-messages-dropdown', 'Disappearing messages');
  // Select 5 seconds
  await sleepFor(200);
  await clickOnTestIdWithText(windowA, 'dropdownitem-5-seconds', '5 seconds');
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
  await windowA.close();
  await windowB.bringToFront();
  await clickOnTestIdWithText(
    windowB,
    'control-message',
    `${userA.userName} set the disappearing message timer to 5 seconds`
  );
  await hasTextElementBeenDeleted(windowB, sentMessage, 5000);
});
