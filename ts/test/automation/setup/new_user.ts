import { Page } from '@playwright/test';
import { User } from '../types/testing';
import { checkPathLight, clickOnMatchingText, typeIntoInput } from '../utilities/utils';
// tslint:disable: no-console
export const newUser = async (window: Page, userName: string): Promise<User> => {
  // Create User
  await clickOnMatchingText(window, 'Create Session ID');
  // Wait for animation for finish creating ID
  await window.waitForTimeout(1500);
  //Save session ID to a variable
  const sessionid = await window.inputValue('[data-testid=session-id-signup]');
  await clickOnMatchingText(window, 'Continue');
  // Input username = testuser
  await typeIntoInput(window, 'display-name-input', userName);
  await clickOnMatchingText(window, 'Get started');
  // save recovery phrase
  await clickOnMatchingText(window, 'Reveal Recovery Phrase');
  const recoveryPhrase = await window.innerText('[data-testid=recovery-phrase-seed-modal]');

  console.info(`${userName}: Session ID: ${sessionid} and Recovery phrase: ${recoveryPhrase}`);
  await window.click('.session-icon-button.small');
  await checkPathLight(window);
  return { userName, sessionid, recoveryPhrase };
};


