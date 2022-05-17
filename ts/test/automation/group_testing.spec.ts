import { _electron, expect, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
// import { recoverFromSeed } from './setup/recovery_using_seed';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  waitForMatchingText,
  // waitForTestIdWithText,
} from './utils';
// import { testContact, testUser } from './setup/test_user';
// import { openAppsNoNewUsers } from './setup/new_user';
import { renameGroup } from './rename_group';
import { leaveGroup } from './leave_group';
import { createGroup } from './setup/create_group';

test.beforeEach(cleanUpOtherTest);

let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

test('Group testing', async () => {
  // Open Electron
  const { windowA, windowB } = await createGroup('Test Group Name');
  windows = [windowA, windowB];
  // Change the name of the group and check that it syncs to all devices (config messages)
  // Click on already created group
  // Check that renaming a group is working
  await renameGroup(windowA, 'Test Group Name', 'newGroupName');
  // Check config message in window B for group name change
  await clickOnMatchingText(windowB, 'newGroupName');
  await waitForMatchingText(windowB, "Group name is now 'newGroupName'.");
  // Change the group name back to original name
  // Click on conversation options
  await renameGroup(windowA, 'newGroupName', 'Test Group Name');

  // Check to see that you can't change group name to empty string
  // Click on edit group name
  await clickOnMatchingText(windowA, 'Edit group name');
  await windowA.fill('.profile-name-input', '   ');
  await windowA.keyboard.press('Enter');
  const errorMessage = windowA.locator('.error-message');
  await expect(errorMessage).toContainText('Please enter a group name');
  await clickOnMatchingText(windowA, 'Cancel');
  await clickOnTestIdWithText(windowA, 'back-button-conversation-options');

  // Leave group and receive config confirmation
  await leaveGroup(windowB);
});
