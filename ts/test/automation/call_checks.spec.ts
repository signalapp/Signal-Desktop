import { test } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { createContact } from './utilities/create_contact';
import { clickOnMatchingText, clickOnTestIdWithText } from './utilities/utils';

test('Voice calls', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);

  await createContact(windowA, windowB, userA, userB);
  await clickOnTestIdWithText(windowA, 'call-button');
  await clickOnTestIdWithText(windowA, 'session-toast');
  await clickOnTestIdWithText(windowA, 'enable-calls');
  await clickOnTestIdWithText(windowA, 'session-confirm-ok-button');
  await clickOnTestIdWithText(windowA, 'message-section');
  await clickOnTestIdWithText(windowA, 'module-conversation__user__profile-name', userB.userName);
  await clickOnTestIdWithText(windowA, 'call-button');
  // Enable calls in window B
  await clickOnTestIdWithText(windowB, 'session-toast');
  await clickOnTestIdWithText(windowB, 'enable-calls');
  await clickOnTestIdWithText(windowB, 'session-confirm-ok-button');
  await clickOnMatchingText(windowB, 'Accept');
  await sleepFor(5000);
  await clickOnTestIdWithText(windowA, 'end-call');
});
