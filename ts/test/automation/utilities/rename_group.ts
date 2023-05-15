import { _electron, Page } from '@playwright/test';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utils';

export const renameGroup = async (window: Page, oldGroupName: string, newGroupName: string) => {
  await clickOnMatchingText(window, oldGroupName);
  await clickOnTestIdWithText(window, 'conversation-options-avatar');
  await clickOnMatchingText(window, 'Edit group name');
  await typeIntoInput(window, 'group-name-input', newGroupName);
  await window.keyboard.press('Enter');
  await waitForTestIdWithText(window, 'right-panel-group-name', newGroupName);
  await clickOnTestIdWithText(window, 'back-button-conversation-options');
  // Check config message
  await waitForMatchingText(window, `Group name is now '${newGroupName}'.`);
};
