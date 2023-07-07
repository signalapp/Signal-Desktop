import { expect, Page, test } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';
import { beforeAllClean, forceCloseAllWindows } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { createContact } from './utilities/create_contact';
import { linkedDevice } from './utilities/linked_device';
import { sendMessage } from './utilities/message';
import {
  clickOnElement,
  clickOnMatchingText,
  clickOnTestIdWithText,
  hasTextElementBeenDeleted,
  typeIntoInput,
  waitForMatchingText,
  waitForTestIdWithText,
  waitForTextMessage,
} from './utilities/utils';

const windows: Array<Page> = [];
test.beforeEach(beforeAllClean);

test.afterEach(() => forceCloseAllWindows(windows));
// tslint:disable: no-console

test('Link a device', async () => {
  const [windowA] = await openApp(1); // not using sessionTest here as we need to close and reopen one of the window
  const userA = await newUser(windowA, 'Alice');
  const [windowB] = await linkedDevice(userA.recoveryPhrase); // not using sessionTest here as we need to close and reopen one of the window
  await clickOnTestIdWithText(windowA, 'leftpane-primary-avatar');
  // Verify Username
  await waitForTestIdWithText(windowA, 'your-profile-name', userA.userName);
  // Verify Session ID
  await waitForTestIdWithText(windowA, 'your-session-id', userA.sessionid);
  // exit profile module
  await clickOnTestIdWithText(windowA, 'modal-close-button');
  // You're almost finished isn't displayed
  const errorDesc = 'Should not be found';
  try {
    const elemShouldNotBeFound = windowB.locator('[data-testid=reveal-recovery-phrase]');
    if (elemShouldNotBeFound) {
      console.error('Continue to save recovery phrase not found, excellent news');
      throw new Error(errorDesc);
    }
  } catch (e) {
    if (e.message !== errorDesc) {
      // this is NOT ok
      throw e;
    }
  }
});

test('Check changed username syncs', async () => {
  const [windowA] = await openApp(1);
  const userA = await newUser(windowA, 'Alice');
  const [windowB] = await linkedDevice(userA.recoveryPhrase);
  const newUsername = 'Tiny bubble';
  await clickOnTestIdWithText(windowA, 'leftpane-primary-avatar');
  // Click on pencil icon
  await clickOnTestIdWithText(windowA, 'edit-profile-icon');
  // Replace old username with new username
  await typeIntoInput(windowA, 'profile-name-input', newUsername);
  // Press enter to confirm change
  await clickOnElement(windowA, 'data-testid', 'save-button-profile-update');
  // Wait for loading animation
  // Check username change in window B
  // Click on profile settings in window B
  await clickOnTestIdWithText(windowB, 'leftpane-primary-avatar');
  // Verify username has changed to new username
  await waitForTestIdWithText(windowB, 'your-profile-name', newUsername);
});

test('Check profile picture syncs', async () => {
  const [windowA] = await openApp(1); // not using sessionTest here as we need to close and reopen one of the window
  const userA = await newUser(windowA, 'Alice');
  const [windowB] = await linkedDevice(userA.recoveryPhrase); // not using sessionTest here as we need to close and reopen one of the window
  await clickOnTestIdWithText(windowA, 'leftpane-primary-avatar');
  // Click on current profile picture
  await waitForTestIdWithText(windowA, 'copy-button-profile-update', 'Copy');

  await clickOnTestIdWithText(windowA, 'image-upload-section');
  await clickOnTestIdWithText(windowA, 'save-button-profile-update');
  await waitForTestIdWithText(windowA, 'loading-spinner');

  await waitForTestIdWithText(windowA, 'copy-button-profile-update', 'Copy');
  await clickOnTestIdWithText(windowA, 'modal-close-button');

  await sleepFor(500);
  const leftpaneAvatarContainer = await waitForTestIdWithText(windowB, 'leftpane-primary-avatar');
  await sleepFor(500);
  const screenshot = await leftpaneAvatarContainer.screenshot({
    type: 'jpeg',
    // path: 'avatar-updated-blue',
  });
  expect(screenshot).toMatchSnapshot({ name: 'avatar-updated-blue.jpeg' });
});

test('Check contacts syncs', async () => {
  const [windowA, windowC] = await openApp(2); // not using sessionTest here as we need to close and reopen one of the window
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowC, 'Bob')]);
  const [windowB] = await linkedDevice(userA.recoveryPhrase); // not using sessionTest here as we need to close and reopen one of the window
  await createContact(windowA, windowC, userA, userB);
  // Check linked device (windowB)
  await waitForTestIdWithText(windowB, 'module-conversation__user__profile-name', userB.userName);
  console.info('Contacts correctly synced');
});

test('Check deleted message syncs', async () => {
  const [windowA, windowC] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowC, 'Bob')]);
  const [windowB] = await linkedDevice(userA.recoveryPhrase);
  const deletedMessage = 'Testing deletion functionality for linked device';
  await createContact(windowA, windowC, userA, userB);
  await sendMessage(windowA, deletedMessage);
  // Navigate to conversation on linked device and check for message from user A to user B
  await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userB.userName);
  await waitForTextMessage(windowB, deletedMessage);
  await waitForTextMessage(windowC, deletedMessage);
  await clickOnTestIdWithText(windowA, 'readable-message', deletedMessage, true);
  await clickOnMatchingText(windowA, 'Delete just for me');
  await clickOnMatchingText(windowA, 'Delete');
  await waitForTestIdWithText(windowA, 'session-toast', 'Deleted');
  await hasTextElementBeenDeleted(windowA, deletedMessage, 1000);
  // Check linked device for deleted message
  // Waiting for message to be removed
  await sleepFor(5000);
  await hasTextElementBeenDeleted(windowB, deletedMessage, 1000);
  // Still should exist for user B
  await waitForMatchingText(windowC, deletedMessage);
});

test('Check unsent message syncs', async () => {
  const [windowA, windowC] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowC, 'Bob')]);
  const [windowB] = await linkedDevice(userA.recoveryPhrase);
  const unsentMessage = 'Testing unsending functionality for linked device';
  await createContact(windowA, windowC, userA, userB);
  await sendMessage(windowA, unsentMessage);
  // Navigate to conversation on linked device and check for message from user A to user B
  await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userB.userName);
  await waitForTextMessage(windowB, unsentMessage);
  await waitForTextMessage(windowC, unsentMessage);
  await clickOnTestIdWithText(windowA, 'readable-message', unsentMessage, true);
  await clickOnMatchingText(windowA, 'Delete for everyone');
  await clickOnElement(windowA, 'data-testid', 'session-confirm-ok-button');
  await waitForTestIdWithText(windowA, 'session-toast', 'Deleted');
  await hasTextElementBeenDeleted(windowA, unsentMessage, 1000);
  await waitForMatchingText(windowC, 'This message has been deleted');
  // Check linked device for deleted message
  await hasTextElementBeenDeleted(windowB, unsentMessage, 1000);
});

test('Check blocked user syncs', async () => {
  const [windowA, windowC] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowC, 'Bob')]);
  const [windowB] = await linkedDevice(userA.recoveryPhrase);
  const testMessage = 'Testing blocking functionality for linked device';
  await createContact(windowA, windowC, userA, userB);
  await sendMessage(windowA, testMessage);
  // Navigate to conversation on linked device and check for message from user A to user B
  await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', userB.userName);
  await clickOnElement(windowA, 'data-testid', 'three-dots-conversation-options');
  await clickOnMatchingText(windowA, 'Block');
  await waitForTestIdWithText(windowA, 'session-toast', 'Blocked');
  // await waitForMatchingText(windowA, 'Unblock this contact to send a message.');
  // Check linked device for blocked contact in settings screen
  await clickOnTestIdWithText(windowB, 'settings-section');
  await clickOnTestIdWithText(windowB, 'conversations-settings-menu-item');
  // a conf sync job can take 30s (if the last one failed) +  10s polling to show a change on a linked device.
  await clickOnTestIdWithText(windowB, 'reveal-blocked-user-settings', undefined, undefined, 50000);
  // Check if user B is in blocked contact list
  await waitForMatchingText(windowB, userB.userName);
});
