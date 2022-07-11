import { _electron, Page } from '@playwright/test';
import { clickOnTestIdWithText, typeIntoInput } from '../utils';

export async function recoverFromSeed(window: Page, userName: string, recoveryPhrase: string) {
  await clickOnTestIdWithText(window, 'restore-using-recovery');
  await typeIntoInput(window, 'recovery-phrase-input', recoveryPhrase);
  await typeIntoInput(window, 'display-name-input', userName);
  await clickOnTestIdWithText(window, 'continue-session-button');

  return { window };
}
