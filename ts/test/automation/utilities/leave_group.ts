import { Page } from '@playwright/test';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForGroupUpdateMessageWithText,
} from './utils';

export const leaveGroup = async (window: Page) => {
  // go to three dots menu
  await clickOnTestIdWithText(window, 'three-dots-conversation-options');
  // Select Leave Group
  await clickOnMatchingText(window, 'Leave Group');
  // Confirm leave group
  await clickOnTestIdWithText(window, 'session-confirm-ok-button', 'OK');
  // check group update message
  await waitForGroupUpdateMessageWithText(window, 'You have left the group'); // TODO this needs to be updated as groups left are deleted right away now
};
