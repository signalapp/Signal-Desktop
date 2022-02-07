import { _electron, Page } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';

export const logIn = async (window: Page, userName: string, recoveryPhrase: string) => {
  // restore account
  await window.click('[data-testid=restore-using-recovery');
  // Enter recovery phrase
  await window.fill('[data-testid=recovery-phrase-input]', recoveryPhrase);
  // Enter display name
  await window.fill('[data-testid=display-name-input]', userName);
  // Click continue your session
  await window.click('[data-testid=continue-session-button]');

  await sleepFor(100);
};
