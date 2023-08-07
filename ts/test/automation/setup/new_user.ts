import { Page } from '@playwright/test';
import { User } from '../types/testing';
import { clickOnMatchingText, clickOnTestIdWithText, typeIntoInput } from '../utilities/utils';

export const newUser = async (window: Page, userName: string): Promise<User> => {
  // Create User
  await clickOnMatchingText(window, 'Create Session ID');
  await clickOnMatchingText(window, 'Continue');
  // Input username = testuser
  await typeIntoInput(window, 'display-name-input', userName);
  await clickOnMatchingText(window, 'Get started');
  // save recovery phrase
  await clickOnMatchingText(window, 'Reveal Recovery Phrase');
  const recoveryPhrase = await window.innerText('[data-testid=recovery-phrase-seed-modal]');
  await window.click('.session-icon-button.small');

  await clickOnTestIdWithText(window, 'leftpane-primary-avatar');

  // Save session ID to a variable
  let sessionid = await window.innerText('[data-testid=your-session-id]');
  sessionid = sessionid.replace(/(\r\n|\n|\r)/gm, ''); // remove the new line in the SessionID as it is rendered with one forced

  console.info(`${userName}: Session ID: ${sessionid} and Recovery phrase: ${recoveryPhrase}`);
  await window.click('.session-icon-button.small');
  return { userName, sessionid, recoveryPhrase };
};
