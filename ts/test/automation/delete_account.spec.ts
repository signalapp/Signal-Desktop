import { _electron, test } from '@playwright/test';
import { beforeAllClean, forceCloseAllWindows } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { sendNewMessage } from './utilities/send_message';
import { clickOnMatchingText, clickOnTestIdWithText, hasElementBeenDeleted, typeIntoInput } from './utilities/utils';
import { sleepFor } from '../../session/utils/Promise';
import { openApp } from './setup/open';
// tslint:disable: no-console

test.beforeEach(beforeAllClean);

test('Delete account from swarm', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // Create contact and send new message
  await Promise.all([
    sendNewMessage(windowA, userB.sessionid, testMessage),
    sendNewMessage(windowB, userA.sessionid, testReply),
  ]);
  // Delete all data from device
  // Click on settings tab
  await clickOnTestIdWithText(windowA, 'settings-section');
  // Click on clear all data
  await clickOnTestIdWithText(windowA, 'clear-data-settings-menu-item', 'Clear Data');
  // Select entire account
  await clickOnTestIdWithText(windowA, 'label-device_and_network', 'Clear Device and Network');
  // Confirm deletion by clicking Clear, twice
  await clickOnMatchingText(windowA, 'Clear');
  await clickOnMatchingText(windowA, 'Clear');
  await windowA.waitForTimeout(7500);
  // Wait for window to close and reopen
  await sleepFor(10000, true);
  // await windowA.close();
  const restoringWindows = await openApp(1);
  const [restoringWindow] = restoringWindows;
  // Sign in with deleted account and check that nothing restores
  await clickOnTestIdWithText(restoringWindow, 'restore-using-recovery', 'Restore your account');
  // Fill in recovery phrase
  await typeIntoInput(restoringWindow, 'recovery-phrase-input', userA.recoveryPhrase);
  // Enter display name
  await typeIntoInput(restoringWindow, 'display-name-input', userA.userName);
  // Click continue
  await clickOnTestIdWithText(restoringWindow, 'continue-session-button');
  console.log('sleeping for 20000ms');
  await sleepFor(20000); // just to allow any messages from our swarm to show up
  // Check if message from user B is restored (we don't want it to be)
  await hasElementBeenDeleted(restoringWindow, "data-testid", 'module-conversation-list-item');
  await clickOnTestIdWithText(restoringWindow, 'new-conversation-button'); // Expect contacts list to be empty
  await hasElementBeenDeleted(restoringWindow, 'data-testid', 'module-conversation__user__profile-name');
  
  await forceCloseAllWindows(restoringWindows);
});
