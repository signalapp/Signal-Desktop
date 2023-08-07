import { test } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';
import { beforeAllClean, forceCloseAllWindows } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { createContact } from './utilities/create_contact';
import { sendNewMessage } from './utilities/send_message';
import {
  clickOnElement,
  clickOnMatchingText,
  clickOnTestIdWithText,
  hasElementBeenDeleted,
  hasTextElementBeenDeleted,
  typeIntoInput,
  waitForElement,
  waitForLoadingAnimationToFinish,
} from './utilities/utils';

test.beforeEach(beforeAllClean);

test('Delete account from swarm', async () => {
  const [windowA, windowB] = await openApp(2); // not using sessionTest here as we need to close and reopen one of the window
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
  await waitForLoadingAnimationToFinish(windowA, 'loading-spinner');
  // await windowA.waitForTimeout(7500);
  // Wait for window to close and reopen
  await sleepFor(10000, true);
  // await windowA.close();
  const restoringWindows = await openApp(1); // not using sessionTest here as we need to close and reopen one of the window
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

  // Need to verify that no conversation is found at all

  await hasElementBeenDeleted(restoringWindow, 'data-testid', 'conversation-list-item');

  await clickOnTestIdWithText(restoringWindow, 'new-conversation-button'); // Expect contacts list to be empty

  await hasTextElementBeenDeleted(restoringWindow, 'contact');
  await forceCloseAllWindows(restoringWindows);
});

test('Delete account from device', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  // Create contact and send new message
  await createContact(windowA, windowB, userA, userB);
  // Delete all data from device
  // Click on settings tab
  await clickOnTestIdWithText(windowA, 'settings-section');
  // Click on clear all data
  await clickOnTestIdWithText(windowA, 'clear-data-settings-menu-item', 'Clear Data');
  // Keep 'Clear Device only' selection
  // Confirm deletion by clicking Clear, twice
  await clickOnMatchingText(windowA, 'Clear');
  await clickOnMatchingText(windowA, 'Clear');
  await waitForLoadingAnimationToFinish(windowA, 'loading-spinner');
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
  console.log('sleeping for 2000ms');
  await sleepFor(2000); // just to allow any messages from our swarm to show up
  // Check if message from user B is restored
  await waitForElement(
    restoringWindow,
    'data-testid',
    'module-conversation__user__profile-name',
    1000,
    userB.userName
  );
  // Check if contact is available in contacts section
  await clickOnElement(restoringWindow, 'data-testid', 'new-conversation-button');
  await waitForElement(
    restoringWindow,
    'data-testid',
    'module-conversation__user__profile-name',
    1000,
    userB.userName
  );

  await hasElementBeenDeleted(restoringWindow, 'data-testid', 'conversation-list-item');

  await clickOnTestIdWithText(restoringWindow, 'new-conversation-button'); // Expect contacts list to be empty

  await hasTextElementBeenDeleted(restoringWindow, 'contact');
  await forceCloseAllWindows(restoringWindows);
});
