import { _electron, Page } from '@playwright/test';
import { clickOnTestIdWithText, typeIntoInput } from '../utils';

export async function logIn(window: Page, recoveryPhrase: string) {
  await clickOnTestIdWithText(window, 'link-device');
  await typeIntoInput(window, 'recovery-phrase-input', recoveryPhrase);
  await clickOnTestIdWithText(window, 'continue-session-button');

  return { window };
}
