import { _electron, Page } from '@playwright/test';
import _ from 'lodash';
import { clickOnMatchingText, typeIntoInput } from '../utils';
import { openAppAndWait } from './open';
const multisAvailable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export type UserLoggedInType = {
  userName: string;
  sessionid: string;
  recoveryPhrase: string;
};

export const newUser = async (window: Page, userName: string): Promise<UserLoggedInType> => {
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

  await window.click('.session-icon-button.small');
  return { userName, sessionid, recoveryPhrase };
};

const openAppAndNewUser = async (multi: string): Promise<UserLoggedInType & { window: Page }> => {
  const window = await openAppAndWait(multi);

  const userName = `${multi}-user`;
  const loggedIn = await newUser(window, userName);
  return { window, ...loggedIn };
};

export async function openAppsAndNewUsers(windowToCreate: number) {
  if (windowToCreate >= multisAvailable.length) {
    throw new Error(`Do you really need ${multisAvailable.length} windows?!`);
  }
  // if windowToCreate = 3, this array will be ABC. If windowToCreate = 5, this array will be ABCDE
  const multisToUse = multisAvailable.slice(0, windowToCreate);
  const loggedInDetails = await Promise.all(
    [...multisToUse].map(async m => {
      return openAppAndNewUser(m);
    })
  );

  const windows = loggedInDetails.map(w => w.window);
  const users = loggedInDetails.map(w => {
    return _.pick(w, ['sessionid', 'recoveryPhrase', 'userName']);
  });
  return { windows, users };
}

export async function openAppsNoNewUsers(windowToCreate: number) {
  if (windowToCreate >= multisAvailable.length) {
    throw new Error(`Do you really need ${multisAvailable.length} windows?!`);
  }
  // if windowToCreate = 3, this array will be ABC. If windowToCreate = 5, this array will be ABCDE
  const multisToUse = multisAvailable.slice(0, windowToCreate);
  return Promise.all(
    [...multisToUse].map(async m => {
      return openAppAndWait(`${m}`);
    })
  );
}
