import { test } from '@playwright/test';
import { beforeAllClean } from './setup/beforeEach';
// import { leaveGroup } from './utilities/leave_group';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { linkedDevice } from './utilities/linked_device';
import { sendMessage } from './utilities/message';
import { sendNewMessage } from './utilities/send_message';
import {
  clickOnTestIdWithText,
  waitForMatchingText,
  waitForTestIdWithText,
  waitForTextMessage,
} from './utilities/utils';

test.beforeEach(beforeAllClean);

test('Accept request syncs', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  const [windowC] = await linkedDevice(userB.recoveryPhrase);

  const testMessage = `${userA.userName} sending message request to ${userB.userName}`;
  const testReply = `${userB.userName} accepting message request from ${userA.userName}`;
  await sendNewMessage(windowA, userB.sessionid, testMessage);
  // Accept request in windowB
  await clickOnTestIdWithText(windowB, 'message-request-banner');
  await clickOnTestIdWithText(windowC, 'message-request-banner');
  await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);
  await clickOnTestIdWithText(windowB, 'accept-message-request');
  await waitForTestIdWithText(
    windowB,
    'control-message',
    `You have accepted ${userA.userName}'s message request`
  );
  await waitForMatchingText(windowB, 'No pending message requests');
  await waitForMatchingText(windowC, 'No pending message requests');
  await sendMessage(windowB, testReply);
  await waitForTextMessage(windowA, testReply);
  await clickOnTestIdWithText(windowC, 'new-conversation-button');
  await waitForTestIdWithText(windowC, 'module-conversation__user__profile-name', userA.userName);
});

test('Decline request syncs', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  const [windowC] = await linkedDevice(userB.recoveryPhrase);

  const testMessage = `${userA.userName} sending message request to ${userB.userName}`;
  await sendNewMessage(windowA, userB.sessionid, testMessage);
  // Accept request in windowB
  await clickOnTestIdWithText(windowB, 'message-request-banner');
  await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);
  await clickOnTestIdWithText(windowC, 'message-request-banner');
  await waitForTestIdWithText(windowC, 'module-conversation__user__profile-name', userA.userName);
  await clickOnTestIdWithText(windowB, 'decline-message-request');
  await clickOnTestIdWithText(windowB, 'session-confirm-ok-button', 'Decline');
  await waitForTestIdWithText(windowB, 'session-toast', 'Blocked');

  await waitForMatchingText(windowB, 'No pending message requests');
  await waitForMatchingText(windowC, 'No pending message requests');
});
