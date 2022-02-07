import { _electron, expect, Page, test } from '@playwright/test';
import { newUser } from './new_user';
import { openApp } from './open';
import { sleepFor } from '../../session/utils/Promise';

// import {emptyDirSync} from 'fs-extra';

let window: Page | undefined;

test('Create User', async () => {
  // Launch Electron app.
  window = await openApp('1');
  // Create User
  const userA = await newUser(window, 'userA');

  await window.click('[data-testid=leftpane-primary-avatar]');
  await sleepFor(100);
  //check username matches
  expect(await window.innerText('[data-testid=your-profile-name]')).toBe(userA.userName);
  //check session id matches
  expect(await window.innerText('[data-testid=your-session-id]')).toBe(userA.sessionid);
  // exit profile module
  await window.click('.session-icon-button.small');
  // go to settings section
  await window.click('[data-testid=settings-section]');
  await window.click('text=Recovery Phrase');
  // check recovery phrase matches
  expect(await window.innerText('[data-testid=recovery-phrase-seed-modal]')).toBe(
    userA.recoveryPhrase
  );
  // Exit profile module
  await window.click('.session-icon-button.small');
});
