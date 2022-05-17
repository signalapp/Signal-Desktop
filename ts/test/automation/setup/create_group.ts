import { _electron, Page } from '@playwright/test';
import { messageSent } from '../message';
import { openAppsAndNewUsers } from '../setup/new_user';
import { sendNewMessage } from '../send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  waitForReadableMessageWithText,
  waitForTestIdWithText,
} from '../utils';

let windows: Array<Page> = [];

export const createGroup = async (groupName: string) => {
  const windowLoggedIn = await openAppsAndNewUsers(3);
  windows = windowLoggedIn.windows;
  const users = windowLoggedIn.users;
  const [windowA, windowB, windowC] = windows;
  const [userA, userB, userC] = users;
  // Add contacts
  await sendNewMessage(windowA, userC.sessionid, `A -> C: ${Date.now()}`);
  await Promise.all([
    sendNewMessage(windowA, userB.sessionid, `A -> B: ${Date.now()}`),
    sendNewMessage(windowB, userA.sessionid, `B -> A: ${Date.now()}`),
    sendNewMessage(windowC, userA.sessionid, `C -> A: ${Date.now()}`),
  ]);
  // Focus screen on window C to allow user C to become contact
  await clickOnTestIdWithText(windowC, 'messages-container');
  // wait for user C to be contact before moving to create group
  // Create group with existing contact and session ID (of non-contact)
  // Click new closed group tab
  await clickOnMatchingText(windowA, 'New Closed Group');
  // Enter group name
  await typeIntoInput(windowA, 'new-closed-group-name', groupName);
  // Select user B
  await clickOnMatchingText(windowA, userB.userName);
  // Select user C
  await clickOnMatchingText(windowA, userC.userName);
  // Click Done
  await clickOnMatchingText(windowA, 'Done');
  // Check group was successfully created
  await clickOnMatchingText(windowB, groupName);
  await waitForTestIdWithText(windowB, 'header-conversation-name', groupName);
  // Send message in group chat from user A
  const msgAToGroup = 'A -> Group';
  await messageSent(windowA, msgAToGroup);
  // Focus screen
  await clickOnMatchingText(windowA, msgAToGroup);
  // Verify it was received by other two accounts
  // Navigate to group in window B
  await clickOnTestIdWithText(windowB, 'message-section');
  // Click on test group
  await clickOnMatchingText(windowB, groupName);
  // wait for selector 'test message' in chat window
  await waitForReadableMessageWithText(windowB, msgAToGroup);
  // Send reply message
  const msgBToGroup = 'B -> Group';
  await messageSent(windowB, msgBToGroup);
  // Focus screen
  // await clickOnTestIdWithText(windowB, 'scroll-to-bottom-button');
  await clickOnMatchingText(windowB, msgBToGroup);
  // Navigate to group in window C
  await clickOnTestIdWithText(windowC, 'message-section');
  // Click on test group
  await clickOnMatchingText(windowC, groupName);
  // windowC must see the message from A and the message from B
  await waitForReadableMessageWithText(windowC, msgAToGroup);
  await waitForReadableMessageWithText(windowC, msgBToGroup);
  // Send message from C to the group
  const msgCToGroup = 'C -> Group';
  await messageSent(windowC, msgCToGroup);
  // windowA should see the message from B and the message from C
  await waitForReadableMessageWithText(windowA, msgBToGroup);
  await waitForReadableMessageWithText(windowA, msgCToGroup);

  return { userA, userB, windowA, windowB, userC, windowC };
};
