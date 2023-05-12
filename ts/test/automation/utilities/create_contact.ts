import { Page } from '@playwright/test';
import { User } from '../types/testing';
import { sendNewMessage } from './send_message';
import { clickOnTestIdWithText, waitForTestIdWithText } from './utils';

export const createContact = async (windowA: Page, windowB: Page, userA: User, userB: User) => {
  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // User A sends message to User B
  await sendNewMessage(windowA, userB.sessionid, testMessage);
  // User B sends message to User B to USER A
  await sendNewMessage(windowB, userA.sessionid, testReply);

  await clickOnTestIdWithText(windowA, 'new-conversation-button');
  await windowA.waitForTimeout(2000);
  await waitForTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);

  // Navigate to contacts tab in User A's window
  await clickOnTestIdWithText(windowA, 'new-conversation-button');
};
