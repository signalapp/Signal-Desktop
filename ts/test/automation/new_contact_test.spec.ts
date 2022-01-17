import { _electron, expect, test } from '@playwright/test';
import { newUser } from './new_user';
import { openApp } from './open';
import { sendMessage } from './send_message';

const userADisplayName = 'userA';
const userBDisplayName = 'userB';

const timeStamp = Date.now();

const testMessage = 'Test-Message-';
const testReply = 'Sending Reply Test Message';

// Send message in one to one conversation with new contact
test('Send message to new contact', async () => {
  const [windowA, windowB] = await Promise.all([openApp('1'), openApp('2')]);
  // Create User A
  const userA = await newUser(windowA, userADisplayName);
  // Create User B
  const userB = await newUser(windowB, userBDisplayName);
  // User A sends message to User B
  await sendMessage(windowA, userB.sessionid, `${testMessage} + ${timeStamp}`);
  windowA.locator(`${testMessage} > svg`).waitFor;
  await windowA.isVisible('[data-testid=msg-status-outgoing]');
  await windowA.waitForTimeout(5500);
  // User B sends message to User B to USER A
  await sendMessage(windowB, userA.sessionid, `${testReply} + ${timeStamp}`);
  await windowA.waitForTimeout(5500);
  // Navigate to contacts tab in User B's window
  await windowB.click('[data-testid=contact-section]');
  await windowA.waitForTimeout(2500);
  expect(await windowB.innerText('.module-conversation__user__profile-name')).toBe(userA.userName);
  // Navigate to contacts tab in User A's window
  await windowA.click('[data-testid=contact-section]');
  expect(await windowA.innerText('.module-conversation__user__profile-name')).toBe(userB.userName);
});
