import { test } from '@playwright/test';
import { beforeAllClean } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { sessionTestTwoWindows } from './setup/sessionTest';
import { sendMessage } from './utilities/message';
import { sendNewMessage } from './utilities/send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForMatchingText,
  waitForMessageRequestWithText,
} from './utilities/utils';

test.beforeEach(beforeAllClean);

// test.afterEach(() => forceCloseAllWindows(windows));
// Open two windows and log into 2 separate accounts
test.describe('Message requests', () => {
  sessionTestTwoWindows('Message requests accept', async ([windowA, windowB]) => {
    const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
    const testMessage = `Sender: ${userA.userName} Receiver: ${userB.userName}`;
    // send a message to User B from User A
    await sendNewMessage(windowA, userB.sessionid, `${testMessage}`);
    // Check the message request banner appears and click on it
    await clickOnTestIdWithText(windowB, 'message-request-banner');
    // Select message request from User A
    await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);
    // Check that using the accept button has intended use
    await clickOnTestIdWithText(windowB, 'accept-message-request');
    // Check config message of message request acceptance
    await waitForMessageRequestWithText(
      windowB,
      `You have accepted ${userA.userName}'s message request`
    );
    await waitForMatchingText(windowB, 'No pending message requests');
  });
  sessionTestTwoWindows('Message requests text reply', async ([windowA, windowB]) => {
    const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
    const testMessage = `Sender: ${userA.userName}, Receiver: ${userB.userName}`;
    const testReply = `Sender: ${userB.userName}, Receiver: ${userA.userName}`;
    // send a message to User B from User A
    await sendNewMessage(windowA, userB.sessionid, `${testMessage}`);
    // Check the message request banner appears and click on it
    await clickOnTestIdWithText(windowB, 'message-request-banner');
    // Select message request from User A
    await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);
    // Check that using the accept button has intended use
    await sendMessage(windowB, testReply);
    // Check config message of message request acceptance
    await waitForMessageRequestWithText(
      windowB,
      `You have accepted ${userA.userName}'s message request`
    );
    await waitForMatchingText(windowB, 'No pending message requests');
  });
  sessionTestTwoWindows('Message requests decline', async ([windowA, windowB]) => {
    const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
    const testMessage = `Sender: ${userA.userName}, Receiver: ${userB.userName}`;
    // send a message to User B from User A
    await sendNewMessage(windowA, userB.sessionid, `${testMessage}`);
    // Check the message request banner appears and click on it
    await clickOnTestIdWithText(windowB, 'message-request-banner');
    // Select message request from User A
    await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);
    // Check that using the accept button has intended use
    await clickOnTestIdWithText(windowB, 'decline-message-request');
    // Confirm decline
    await clickOnTestIdWithText(windowB, 'session-confirm-ok-button', 'Decline');
    // Check config message of message request acceptance
    await waitForMatchingText(windowB, 'No pending message requests');
  });
  sessionTestTwoWindows('Message requests clear all', async ([windowA, windowB]) => {
    const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
    const testMessage = `Sender: ${userA.userName}, Receiver: ${userB.userName}`;
    // send a message to User B from User A
    await sendNewMessage(windowA, userB.sessionid, `${testMessage}`);
    // Check the message request banner appears and click on it
    await clickOnTestIdWithText(windowB, 'message-request-banner');
    // Select 'Clear All' button
    await clickOnMatchingText(windowB, 'Clear All');
    // Confirm decline
    await clickOnTestIdWithText(windowB, 'session-confirm-ok-button', 'OK');
    // Navigate back to message request folder to check
    await clickOnTestIdWithText(windowB, 'settings-section');

    await clickOnTestIdWithText(windowB, 'message-requests-settings-menu-item', 'Message Requests');
    // Check config message of message request acceptance
    await waitForMatchingText(windowB, 'No pending message requests');
  });
});

// Clear all requests

// Delete request (not a feature yet)
// Block request (not a feature yet)
