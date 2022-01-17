import { _electron, Page } from '@playwright/test';

export const sendMessage = async (window: Page, sessionid: string, message: string) => {
  await window.click('[data-testid=new-conversation-button]');
  // Enter session ID of USER B
  await window.fill('.session-id-editable-textarea', sessionid);
  // click next
  await window.click('text=Next');
  // type into message input box
  await window.fill('[data-testid=message-input] * textarea', message);
  // click up arrow (send)
  await window.click('[data-testid=send-message-button]');
};
