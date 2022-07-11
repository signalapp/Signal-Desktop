import { _electron, Page } from '@playwright/test';
import { clickOnTestIdWithText, typeIntoInput } from './utils';

export const messageSent = async (window: Page, message: string) => {
  // type into message input box
  await typeIntoInput(window, 'message-input-text-area', message);
  // click up arrow (send)
  await clickOnTestIdWithText(window, 'send-message-button');
  // wait for confirmation tick to send reply message
  const selc = `css=[data-testid=readable-message]:has-text("${message}"):has([data-testid=msg-status-outgoing][data-testtype=sent])`;
  console.warn('waiting for sent tick of message: ', message);

  const tickMessageSent = await window.waitForSelector(selc, { timeout: 30000 });
  console.warn('found the tick of message sent: ', message, Boolean(tickMessageSent));
};
