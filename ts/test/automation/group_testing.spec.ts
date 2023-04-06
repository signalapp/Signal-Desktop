import { expect, test } from '@playwright/test';
import { beforeAllClean } from './setup/beforeEach';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForControlMessageWithText,
  waitForMatchingText,
} from './utilities/utils';
import { renameGroup } from './utilities/rename_group';
import { createGroup } from './setup/create_group';
// import { leaveGroup } from './utilities/leave_group';
import { newUser, openApp } from './setup/new_user';

test.beforeEach(beforeAllClean);

// test.afterEach(() => forceCloseAllWindows(windows));

test('Create group', async () => {
  // Open Electron
  const [windowA, windowB, windowC] = await openApp(3);
  const [userA, userB, userC] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowB, 'Bob'),
    newUser(windowC, 'Chloe'),
  ]);
  const testGroupName = 'Tiny Bubble Gang';
  await createGroup(testGroupName, userA, windowA, userB, windowB, userC, windowC);
  // Check config messages in all windows
  await waitForControlMessageWithText(
    windowA,
    `"${userC.userName}", "${userB.userName}", You joined the group.`
  );
  await waitForControlMessageWithText(
    windowB,
    `"${userC.userName}", "${userA.userName}", You joined the group.`
  );
  await waitForControlMessageWithText(
    windowC,
    `"${userB.userName}", "${userA.userName}", You joined the group.`
  );
});

test('Change group name', async () => {
  const [windowA, windowB, windowC] = await openApp(3);
  const [userA, userB, userC] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowB, 'Bob'),
    newUser(windowC, 'Chloe'),
  ]);
  const testGroupName = 'Tiny Bubble Gang';
  const newGroupName = 'Otter lovers';
  const group = await createGroup(testGroupName, userA, windowA, userB, windowB, userC, windowC);
  // Change the name of the group and check that it syncs to all devices (config messages)
  // Click on already created group
  // Check that renaming a group is working
  await renameGroup(windowA, group.userName, newGroupName);
  // Check config message in window B for group name change
  await clickOnMatchingText(windowB, newGroupName);
  await waitForMatchingText(windowB, `Group name is now ${newGroupName}.`);
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
