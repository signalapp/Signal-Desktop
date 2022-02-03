import { _electron, Page } from '@playwright/test';

export const cleanUp = async (window: Page) => {
  await window.click('[data-testid=settings-section]');
  await window.click('text=Clear All Data');
  await window.click('text=Entire Account');
  await window.click('text=I am sure');
  await window.waitForTimeout(10000);
};
