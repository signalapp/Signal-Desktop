import { expect } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';
import { newUser } from './setup/new_user';
import { createContact } from './utilities/create_contact';
import { sendNewMessage } from './utilities/send_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  typeIntoInputSlow,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utilities/utils';
import { sessionTestOneWindow, sessionTestTwoWindows } from './setup/sessionTest';

// Send message in one to one conversation with new contact
sessionTestTwoWindows('Create contact', async ([windowA, windowB]) => {
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);

  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // User A sends message to User B
  await sendNewMessage(windowA, userB.sessionid, `${testMessage} Time: '${Date.now()}'`);
  // User B sends message to User B to USER A
  await sendNewMessage(windowB, userA.sessionid, `${testReply} Time: '${Date.now()}'`);
  // Navigate to contacts tab in User B's window

  await clickOnTestIdWithText(windowA, 'new-conversation-button');
  await windowA.waitForTimeout(2000);
  await waitForTestIdWithText(windowB, 'module-conversation__user__profile-name', userA.userName);

  // Navigate to contacts tab in User A's window
  await clickOnTestIdWithText(windowA, 'new-conversation-button');
});

sessionTestTwoWindows('Block user in conversation options', async ([windowA, windowB]) => {
  // Open app and create user
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);

  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // Create contact and send new message

  await sendNewMessage(windowA, userB.sessionid, `${testMessage} Time: '${Date.now()}'`);
  await sendNewMessage(windowB, userA.sessionid, `${testReply} Time: '${Date.now()}'`);
  // Check to see if User B is a contact
  await clickOnTestIdWithText(windowA, 'new-conversation-button');
  await waitForTestIdWithText(windowA, 'module-conversation__user__profile-name', userB.userName);
  //Click on three dots menu
  await clickOnTestIdWithText(windowA, 'message-section');

  await clickOnTestIdWithText(windowA, 'three-dots-conversation-options');
  // Select block
  await clickOnMatchingText(windowA, 'Block');
  // Verify toast notification 'blocked'
  await waitForTestIdWithText(windowA, 'session-toast', 'Blocked');
  // Verify the user was moved to the blocked contact list
  // Click on settings tab
  await clickOnTestIdWithText(windowA, 'settings-section');
  // click on settings section 'conversation'
  await clickOnTestIdWithText(windowA, 'conversations-settings-menu-item');
  // Navigate to blocked users tab'
  await clickOnTestIdWithText(windowA, 'reveal-blocked-user-settings');
  // select the contact to unblock by clicking on it by name
  await clickOnMatchingText(windowA, userB.userName);
  // Unblock user by clicking on unblock
  await clickOnTestIdWithText(windowA, 'unblock-button-settings-screen');
  // Verify toast notification says unblocked
  await waitForTestIdWithText(windowA, 'session-toast', 'Unblocked');
  await waitForMatchingText(windowA, 'No blocked contacts');
});

sessionTestTwoWindows('Block user in conversation list', async ([windowA, windowB]) => {
  // Open app and create user
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);

  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // Create contact and send new message

  await sendNewMessage(windowA, userB.sessionid, `${testMessage} Time: '${Date.now()}'`);
  await sendNewMessage(windowB, userA.sessionid, `${testReply} Time: '${Date.now()}'`);
  // Check to see if User B is a contact
  await clickOnTestIdWithText(windowA, 'new-conversation-button');
  await waitForTestIdWithText(windowA, 'module-conversation__user__profile-name', userB.userName);
  //Click on three dots menu
  await clickOnTestIdWithText(windowA, 'message-section');

  await clickOnTestIdWithText(
    windowA,
    'module-conversation__user__profile-name',
    userB.userName,
    true
  );
  // Select block
  await clickOnMatchingText(windowA, 'Block');
  // Verify toast notification 'blocked'
  await waitForTestIdWithText(windowA, 'session-toast', 'Blocked');
  // Verify the user was moved to the blocked contact list
  // Click on settings tab
  await clickOnTestIdWithText(windowA, 'settings-section');
  // click on settings section 'conversation'
  await clickOnTestIdWithText(windowA, 'conversations-settings-menu-item');
  // Navigate to blocked users tab'
  await clickOnTestIdWithText(windowA, 'reveal-blocked-user-settings');
  // select the contact to unblock by clicking on it by name
  await clickOnMatchingText(windowA, userB.userName);
  // Unblock user by clicking on unblock
  await clickOnTestIdWithText(windowA, 'unblock-button-settings-screen');
  // Verify toast notification says unblocked
  await waitForTestIdWithText(windowA, 'session-toast', 'Unblocked');
  await waitForMatchingText(windowA, 'No blocked contacts');
});
sessionTestOneWindow('Change username', async ([window]) => {
  // Create user
  const newUsername = 'Tiny bubble';
  await newUser(window, 'Alice');
  // Open Profile
  await clickOnTestIdWithText(window, 'leftpane-primary-avatar');
  // Click on current username to open edit field
  await clickOnTestIdWithText(window, 'edit-profile-icon');
  // Type in new username
  await typeIntoInput(window, 'profile-name-input', newUsername);
  // await window.fill('.profile-name-input', 'new username');
  // Press enter to confirm username input
  await window.keyboard.press('Enter');
  // Wait for Copy button to appear to verify username change
  await window.isVisible("'Copy'");
  // verify name change
  expect(await window.innerText('[data-testid=your-profile-name]')).toBe(newUsername);
  // Exit profile module
  await window.click('.session-icon-button.small');
});

sessionTestOneWindow('Change profile picture', async ([window]) => {
  await newUser(window, 'Alice');
  // Open profile
  await clickOnTestIdWithText(window, 'leftpane-primary-avatar');
  // Click on current profile picture
  await waitForTestIdWithText(window, 'copy-button-profile-update', 'Copy');

  await clickOnTestIdWithText(window, 'image-upload-section');
  await clickOnTestIdWithText(window, 'image-upload-click');
  await clickOnTestIdWithText(window, 'save-button-profile-update');
  await waitForTestIdWithText(window, 'loading-spinner');

  await sleepFor(5000);
  const leftpaneAvatarContainer = await waitForTestIdWithText(window, 'leftpane-primary-avatar');
  await sleepFor(500);
  const screenshot = await leftpaneAvatarContainer.screenshot({
    type: 'jpeg',
    // path: 'avatar-updated-blue',
  });
  expect(screenshot).toMatchSnapshot({ name: 'avatar-updated-blue.jpeg' });
});

sessionTestTwoWindows('Set nickname', async ([windowA, windowB]) => {
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  const nickname = 'new nickname for Bob';

  await createContact(windowA, windowB, userA, userB);
  await sleepFor(100);
  await clickOnTestIdWithText(windowA, 'three-dots-conversation-options');
  await clickOnMatchingText(windowA, 'Change Nickname');
  await sleepFor(1000);

  await typeIntoInputSlow(windowA, 'nickname-input', nickname);
  await sleepFor(100);
  await clickOnTestIdWithText(windowA, 'confirm-nickname', 'OK');
  const headerUsername = await waitForTestIdWithText(windowA, 'header-conversation-name');
  const headerUsernameText = await headerUsername.innerText();
  console.warn('Innertext ', headerUsernameText);

  expect(headerUsernameText).toBe(nickname);
  // Check conversation list name also
  const conversationListUsernameText = await waitForTestIdWithText(
    windowA,
    'module-conversation__user__profile-name'
  );
  const conversationListUsername = await conversationListUsernameText.innerText();
  expect(conversationListUsername).toBe(nickname);
});
