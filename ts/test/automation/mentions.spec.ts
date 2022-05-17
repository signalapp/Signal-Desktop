import { _electron, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { clickOnTestIdWithText, typeIntoInput, waitForTestIdWithText } from './utils';
import { createGroup } from './setup/create_group';

test.beforeEach(cleanUpOtherTest);

let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

test('Mentions', async () => {
  const { userA, userB, userC, windowA, windowB, windowC } = await createGroup('Test Group Name');
  windows = [windowA, windowB, windowC];

  // in windowA we should be able to mentions userB and userC

  await clickOnTestIdWithText(
    windowA,
    'module-conversation__user__profile-name',
    'Test Group Name'
  );
  await typeIntoInput(windowA, 'message-input-text-area', '@');
  // does 'message-input-text-area' have aria-expanded: true when @ is typed into input
  await waitForTestIdWithText(windowA, 'mentions-popup-row');
  await waitForTestIdWithText(windowA, 'mentions-popup-row', userB.userName);
  await waitForTestIdWithText(windowA, 'mentions-popup-row', userC.userName);

  // in windowB we should be able to mentions userA and userC
  await clickOnTestIdWithText(
    windowB,
    'module-conversation__user__profile-name',
    'Test Group Name'
  );
  await typeIntoInput(windowB, 'message-input-text-area', '@');
  // does 'message-input-text-area' have aria-expanded: true when @ is typed into input
  await waitForTestIdWithText(windowB, 'mentions-popup-row');
  await waitForTestIdWithText(windowB, 'mentions-popup-row', userA.userName);
  await waitForTestIdWithText(windowB, 'mentions-popup-row', userC.userName);

  // in windowC we should be able to mentions userA and userB
  await clickOnTestIdWithText(
    windowC,
    'module-conversation__user__profile-name',
    'Test Group Name'
  );
  await typeIntoInput(windowC, 'message-input-text-area', '@');
  // does 'message-input-text-area' have aria-expanded: true when @ is typed into input
  await waitForTestIdWithText(windowC, 'mentions-popup-row');
  await waitForTestIdWithText(windowC, 'mentions-popup-row', userA.userName);
  await waitForTestIdWithText(windowC, 'mentions-popup-row', userB.userName);
});
