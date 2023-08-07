import { expect } from '@playwright/test';
import { createGroup } from './setup/create_group';
import { renameGroup } from './utilities/rename_group';
import {
  clickOnElement,
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  waitForControlMessageWithText,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utilities/utils';
// import { leaveGroup } from './utilities/leave_group';
import { sleepFor } from '../../session/utils/Promise';
import { newUser } from './setup/new_user';
import { sessionTestFourWindows, sessionTestThreeWindows } from './setup/sessionTest';
import { createContact } from './utilities/create_contact';
import { leaveGroup } from './utilities/leave_group';

sessionTestThreeWindows('Create group', async ([windowA, windowB, windowC]) => {
  // Open Electron
  const [userA, userB, userC] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowB, 'Bob'),
    newUser(windowC, 'Chloe'),
  ]);

  await createGroup('Tiny Bubble Gang', userA, windowA, userB, windowB, userC, windowC);
  // Check config messages in all windows
  await sleepFor(1000);
  // await waitForTestIdWithText(windowA, 'control-message');
});

sessionTestFourWindows('Add contact to group', async ([windowA, windowB, windowC, windowD]) => {
  const [userA, userB, userC, userD] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowB, 'Bob'),
    newUser(windowC, 'Chloe'),
    newUser(windowD, 'Dracula'),
  ]);
  const testGroup = await createGroup(
    'Tiny Bubble Gang',
    userA,
    windowA,
    userB,
    windowB,
    userC,
    windowC
  );
  // Check config messages in all windows
  await sleepFor(1000);
  await createContact(windowA, windowD, userA, userD);
  await clickOnTestIdWithText(
    windowA,
    'module-conversation__user__profile-name',
    testGroup.userName
  );
  await clickOnElement(windowA, 'data-testid', 'conversation-options-avatar');
  await clickOnElement(windowA, 'data-testid', 'add-user-button');
  // Waiting for animation of right panel to appear
  await sleepFor(1000);
  await clickOnMatchingText(windowA, userD.userName);
  await clickOnMatchingText(windowA, 'OK');
  await waitForControlMessageWithText(windowA, `"${userD.userName}" joined the group.`);
  await waitForControlMessageWithText(windowB, `${userD.sessionid} joined the group.`);
  await waitForControlMessageWithText(windowC, `${userD.sessionid} joined the group.`);
  await clickOnTestIdWithText(
    windowD,
    'module-conversation__user__profile-name',
    testGroup.userName
  );
  const emptyStateGroupText = `You have no messages from ${testGroup.userName}. Send a message to start the conversation!`;
  await waitForTestIdWithText(windowD, 'empty-conversation-notification', emptyStateGroupText);
});

sessionTestThreeWindows('Change group name', async ([windowA, windowB, windowC]) => {
  const [userA, userB, userC] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowB, 'Bob'),
    newUser(windowC, 'Chloe'),
  ]);
  const newGroupName = 'Otter lovers';
  const group = await createGroup(
    'Tiny Bubble Gang',
    userA,
    windowA,
    userB,
    windowB,
    userC,
    windowC
  );
  // Change the name of the group and check that it syncs to all devices (config messages)
  // Click on already created group
  // Check that renaming a group is working
  await renameGroup(windowA, group.userName, newGroupName);
  // Check config message in window B for group name change
  await clickOnMatchingText(windowB, newGroupName);
  await waitForMatchingText(windowB, `Group name is now '${newGroupName}'.`);
  // Click on conversation options
  // Check to see that you can't change group name to empty string
  // Click on edit group name
  await clickOnMatchingText(windowA, 'Edit group name');
  await windowA.fill('.profile-name-input', '   ');
  await windowA.keyboard.press('Enter');
  const errorMessage = windowA.locator('.error-message');
  await expect(errorMessage).toContainText('Please enter a group name');
  await clickOnMatchingText(windowA, 'Cancel');
  await clickOnTestIdWithText(windowA, 'back-button-conversation-options');
});

sessionTestThreeWindows('Test mentions', async ([windowA, windowB, windowC]) => {
  const [userA, userB, userC] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowB, 'Bob'),
    newUser(windowC, 'Chloe'),
  ]);
  const group = await createGroup(
    'Tiny Bubble Gang',
    userA,
    windowA,
    userB,
    windowB,
    userC,
    windowC
  );

  // in windowA we should be able to mentions userB and userC

  await clickOnTestIdWithText(windowA, 'module-conversation__user__profile-name', group.userName);
  await typeIntoInput(windowA, 'message-input-text-area', '@');
  // does 'message-input-text-area' have aria-expanded: true when @ is typed into input
  await waitForTestIdWithText(windowA, 'mentions-popup-row');
  await waitForTestIdWithText(windowA, 'mentions-popup-row', userB.userName);
  await waitForTestIdWithText(windowA, 'mentions-popup-row', userC.userName);

  // in windowB we should be able to mentions userA and userC
  await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', group.userName);
  await typeIntoInput(windowB, 'message-input-text-area', '@');
  // does 'message-input-text-area' have aria-expanded: true when @ is typed into input
  await waitForTestIdWithText(windowB, 'mentions-popup-row');
  await waitForTestIdWithText(windowB, 'mentions-popup-row', userA.userName);
  await waitForTestIdWithText(windowB, 'mentions-popup-row', userC.userName);

  // in windowC we should be able to mentions userA and userB
  await clickOnTestIdWithText(windowC, 'module-conversation__user__profile-name', group.userName);
  await typeIntoInput(windowC, 'message-input-text-area', '@');
  // does 'message-input-text-area' have aria-expanded: true when @ is typed into input
  await waitForTestIdWithText(windowC, 'mentions-popup-row');
  await waitForTestIdWithText(windowC, 'mentions-popup-row', userA.userName);
  await waitForTestIdWithText(windowC, 'mentions-popup-row', userB.userName);
});

sessionTestThreeWindows('Leave group', async ([windowA, windowB, windowC]) => {
  const [userA, userB, userC] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowB, 'Bob'),
    newUser(windowC, 'Chloe'),
  ]);
  await createGroup('Tiny Bubble Gang', userA, windowA, userB, windowB, userC, windowC);

  await leaveGroup(windowC);
});
