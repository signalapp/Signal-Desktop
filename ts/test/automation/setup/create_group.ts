import { _electron, Page } from '@playwright/test';
import { messageSent } from '../utilities/message';
import { sendNewMessage } from '../utilities/send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  waitForControlMessageWithText,
  waitForTestIdWithText,
} from '../utilities/utils';
import { Group, User } from '../types/testing';

// let windows: Array<Page> = [];

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
  // Send message in group chat from user A
  await messageSent(windowA, msgAToGroup);
  // Focus screen
  await clickOnMatchingText(windowA, msgAToGroup);
  // Verify it was received by other two accounts
  // Navigate to group in window B
  await clickOnTestIdWithText(windowB, 'message-section');
  // Click on test group
  await clickOnMatchingText(windowB, userName);
  // wait for selector 'test message' in chat window
  await waitForControlMessageWithText(windowB, msgAToGroup);
  // Send reply message
  await messageSent(windowB, msgBToGroup);
  // Focus screen
  // await clickOnTestIdWithText(windowB, 'scroll-to-bottom-button');
  await clickOnMatchingText(windowB, msgBToGroup);
  // Navigate to group in window C
  await clickOnTestIdWithText(windowC, 'message-section');
  // Click on test group
  await clickOnMatchingText(windowC, userName);
  // windowC must see the message from A and the message from B
  await waitForControlMessageWithText(windowC, msgAToGroup);
  await waitForControlMessageWithText(windowC, msgBToGroup);
  // Send message from C to the group
  await messageSent(windowC, msgCToGroup);
  // windowA should see the message from B and the message from C
  await waitForControlMessageWithText(windowA, msgBToGroup);
  await waitForControlMessageWithText(windowA, msgCToGroup);

  return { userName, userOne, userTwo, userThree };
};
