import { Page } from '@playwright/test';
import { sendMessage } from './message';
import { clickOnMatchingText, clickOnTestIdWithText, waitForTextMessage } from './utils';

export const replyTo = async (window: Page, textMessage: string, replyText: string) => {
  await waitForTextMessage(window, textMessage);
  await clickOnTestIdWithText(window, 'control-message', textMessage, true);
  await clickOnMatchingText(window, 'Reply to message');
  await sendMessage(window, replyText);
  console.warn();
};
