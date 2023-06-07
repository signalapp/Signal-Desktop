import { _electron, Page } from '@playwright/test';
import { sendMessage } from '../utilities/message';
import { sendNewMessage } from '../utilities/send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  waitForControlMessageWithText,
  waitForTestIdWithText,
} from '../utilities/utils';
import { Group, User } from '../types/testing';

export const createGroup = async (
  userName: string,
  userOne: User,
  windowA: Page,
  userTwo: User,
  windowB: Page,
  userThree: User,
  windowC: Page
): Promise<Group> => {
  const group: Group = { userName, userOne, userTwo, userThree };
  const emptyStateGroupText = `You have no messages from ${group.userName}. Send a message to start the conversation!`;

  const messageAB = `${userOne.userName} to ${userTwo.userName}`;
  const messageBA = `${userTwo.userName} to ${userOne.userName}`;
  const messageCA = `${userThree.userName} to ${userOne.userName}`;
  const messageAC = `${userOne.userName} to ${userThree.userName}`;
  const msgAToGroup = `${userOne.userName} -> ${group.userName}`;
  const msgBToGroup = `${userTwo.userName} -> ${group.userName}`;
  const msgCToGroup = `${userThree.userName} -> ${group.userName}`;
  // Add contacts
  await sendNewMessage(windowA, userThree.sessionid, `${messageAC} Time: ${Date.now()}`);
  await Promise.all([
    sendNewMessage(windowA, userTwo.sessionid, `${messageAB} Time: ${Date.now()}`),
    sendNewMessage(windowB, userOne.sessionid, `${messageBA} Time: ${Date.now()}`),
    sendNewMessage(windowC, userOne.sessionid, `${messageCA} Time: ${Date.now()}`),
  ]);
  // Focus screen on window C to allow user C to become contact
  await clickOnTestIdWithText(windowC, 'messages-container');
  // wait for user C to be contact before moving to create group
  // Create group with existing contact and session ID (of non-contact)
  // Click new closed group tab
  await clickOnTestIdWithText(windowA, 'new-conversation-button');
  await clickOnTestIdWithText(windowA, 'chooser-new-group');
  // Enter group name
  await typeIntoInput(windowA, 'new-closed-group-name', group.userName);
  // Select user B
  await clickOnMatchingText(windowA, userTwo.userName);
  // Select user C
  await clickOnMatchingText(windowA, userThree.userName);
  // Click Next
  await clickOnTestIdWithText(windowA, 'next-button');
  // Check group was successfully created
  await clickOnMatchingText(windowB, group.userName);
  await waitForTestIdWithText(windowB, 'header-conversation-name', group.userName);
  // Make sure the empty state is in windowA
  await waitForTestIdWithText(windowA, 'empty-conversation-notification', emptyStateGroupText);

  await Promise.all([
    (async () => {
      // Navigate to group in window B
      await clickOnTestIdWithText(windowB, 'message-section');
      // Click on test group
      await clickOnMatchingText(windowB, group.userName);
      // Make sure the empty state is in windowB
      return waitForTestIdWithText(windowB, 'empty-conversation-notification', emptyStateGroupText);
    })(),
    (async () => {
      // Navigate to group in window C
      await clickOnTestIdWithText(windowC, 'message-section');
      // Click on test group
      await clickOnMatchingText(windowC, group.userName);
      // Make sure the empty state is in windowC
      return waitForTestIdWithText(windowC, 'empty-conversation-notification', emptyStateGroupText);
    })(),
  ]);

  await Promise.all([
    (async () => {
      // Send message in group chat from user A
      await sendMessage(windowA, msgAToGroup);
      // Focus screen
      await clickOnMatchingText(windowA, msgAToGroup);
    })(),
    (async () => {
      // Send message in group chat from user B
      await sendMessage(windowB, msgBToGroup);
      await clickOnMatchingText(windowB, msgBToGroup);
    })(),
    (async () => {
      // Send message from C to the group
      await sendMessage(windowC, msgCToGroup);
      await clickOnMatchingText(windowC, msgCToGroup);
    })(),
  ]);

  // Verify that each messages was received by the other two accounts
  await Promise.all([
    (async () => {
      // windowA should see the message from B and the message from C
      await waitForControlMessageWithText(windowA, msgBToGroup);
      await waitForControlMessageWithText(windowA, msgCToGroup);
    })(),
    (async () => {
      // windowB should see the message from A and the message from C
      await waitForControlMessageWithText(windowB, msgAToGroup);
      await waitForControlMessageWithText(windowB, msgCToGroup);
    })(),
    (async () => {
      // windowC must see the message from A and the message from B
      await waitForControlMessageWithText(windowC, msgAToGroup);
      await waitForControlMessageWithText(windowC, msgBToGroup);
    })(),
  ]);

  // Focus screen
  // await clickOnTestIdWithText(windowB, 'scroll-to-bottom-button');

  return { userName, userOne, userTwo, userThree };
};
