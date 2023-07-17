import { Page } from '@playwright/test';
import {
  clickOnTestIdWithText,
  hasElementPoppedUpThatShouldnt,
  typeIntoInput,
  waitForLoadingAnimationToFinish,
} from '../utilities/utils';

export async function logIn(window: Page, recoveryPhrase: string) {
  await clickOnTestIdWithText(window, 'link-device');
  await typeIntoInput(window, 'recovery-phrase-input', recoveryPhrase);
  await clickOnTestIdWithText(window, 'continue-session-button');
  await waitForLoadingAnimationToFinish(window, 'loading-spinner', 5000);
  await hasElementPoppedUpThatShouldnt(
    window,
    'data-testid',
    'session-toast',
    'Could not find your display name. Please Sign In by Restoring Your Account instead.'
  );
}
