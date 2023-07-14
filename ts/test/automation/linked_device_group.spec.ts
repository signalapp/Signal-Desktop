import { test } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';
import { beforeAllClean } from './setup/beforeEach';
import { createGroup } from './setup/create_group';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { leaveGroup } from './utilities/leave_group';
import { linkedDevice } from './utilities/linked_device';
import {
  clickOnTestIdWithText,
  waitForControlMessageWithText,
  waitForTestIdWithText,
} from './utilities/utils';

test.beforeEach(beforeAllClean);

test('Check group and name syncs', async () => {
  const [windowA, windowC, windowD] = await openApp(3);
  const [userA, userB, userC] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowC, 'Bob'),
    newUser(windowD, 'Chloe'),
  ]);
  const [windowB] = await linkedDevice(userA.recoveryPhrase);

  const group = await createGroup(
    'Tiny Bubble Gang',
    userA,
    windowA,
    userB,
    windowC,
    userC,
    windowD
  );
  // Check group conversation is in conversation list
  await waitForTestIdWithText(windowB, 'module-conversation__user__profile-name', group.userName);
});

test('Leaving group syncs', async () => {
  const [windowA, windowC, windowD] = await openApp(3);
  const [userA, userB, userC] = await Promise.all([
    newUser(windowA, 'Alice'),
    newUser(windowC, 'Bob'),
    newUser(windowD, 'Chloe'),
  ]);
  const [windowB] = await linkedDevice(userA.recoveryPhrase);

  const group = await createGroup(
    'Tiny Bubble Gang',
    userA,
    windowA,
    userB,
    windowC,
    userC,
    windowD
  );
  // Check group conversation is in conversation list
  await waitForTestIdWithText(windowB, 'module-conversation__user__profile-name', group.userName);
  // User C to leave group
  await leaveGroup(windowD);
  // Check for user A
  await sleepFor(1000);
  await clickOnTestIdWithText(windowA, 'module-conversation__user__profile-name', group.userName);
  await waitForControlMessageWithText(windowA, `"${userC.userName}" has left the group.`);
  // Check for linked device (userA)
  await clickOnTestIdWithText(windowB, 'module-conversation__user__profile-name', group.userName);
  await waitForControlMessageWithText(windowB, `"${userC.userName}" has left the group.`);
  // Check for user B
  await waitForControlMessageWithText(windowC, `"${userC.userName}" has left the group.`);
});
