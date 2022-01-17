import { _electron, test } from '@playwright/test';
import { newUser } from './new_user';
import { openApp } from './open';
import { sendMessage } from './send_message';

const userADisplayName = 'userA';
const userBDisplayName = 'userB';
const userCDisplayName = 'userC';

const testMessage = 'Sending Test Message';
const testReply = 'Sending Reply Test Message';

test('Create group', async () => {
  // Open Electron
  const [windowA, windowB, windowC] = await Promise.all([openApp('1'), openApp('2'), openApp('3')]);
  // Create User x3
  // create userA
  const userA = await newUser(windowA, userADisplayName);
  // create userB
  const userB = await newUser(windowB, userBDisplayName);
  // Create UserC
  const userC = await newUser(windowC, userCDisplayName);
  // Add contact
  await sendMessage(windowA, userB.sessionid, testMessage);
  await sendMessage(windowB, userA.sessionid, testReply);
  await sendMessage(windowA, userC.sessionid, testMessage);
  await sendMessage(windowC, userA.sessionid, testReply);
  // Create group with existing contact and session ID (of non-contact)
  // Click new closed group tab
  await windowA.click('"New Closed Group"');
  // Enter group name
  await windowA.fill('.session-id-editable', 'Test Group');
  // Select user B
  await windowA.click(userBDisplayName);
  // Select user C
  await windowA.click(userCDisplayName);
  // Click Done
  await windowA.click('"Done"');
  // Check group was successfully created
  windowA.locator(`text=${userBDisplayName}, ${userCDisplayName} + 'You joined the group'`);
  // Send message in group chat from user a
  await windowA.fill('[data-testid=message-input] * textarea', testMessage);
  // Verify it was received by other two accounts
  // Send message from user 2
  // Verify
  // Send message from user 3
  // Verify
});
