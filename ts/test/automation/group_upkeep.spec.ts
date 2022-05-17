import { _electron, Page, test } from '@playwright/test';
import { cleanUpOtherTest, forceCloseAllWindows } from './setup/beforeEach';
import { openAppsNoNewUsers } from './setup/new_user';
import { sendNewMessage } from './send_message';
import { logIn } from './setup/log_in';
import {
  testContactFour,
  testContactOne,
  testContactThree,
  testContactTwo,
  testUser,
} from './setup/test_user';

test.beforeEach(cleanUpOtherTest);

let windows: Array<Page> = [];
test.afterEach(() => forceCloseAllWindows(windows));

test.skip('Group upkeep', async () => {
  const [windowA, windowB, windowC, windowD, windowE] = await openAppsNoNewUsers(5);
  windows = [windowA, windowB, windowC, windowD, windowE];
  await Promise.all([
    logIn(windowA, testUser.recoveryPhrase),
    logIn(windowB, testContactOne.recoveryPhrase),
    logIn(windowC, testContactTwo.recoveryPhrase),
    logIn(windowD, testContactThree.recoveryPhrase),
    logIn(windowE, testContactFour.recoveryPhrase),
  ]);
  // Send message from test users to all of it's contacts to maintain contact status

  // Send message from user A to Whale(TC1)
  await sendNewMessage(
    windowA,
    testContactOne.sessionid,
    `Test user -> Whale (TC1): ${Date.now()}`
  );
  // Send message from Whale to user A
  await sendNewMessage(windowB, testUser.sessionid, `Whale (TC1) -> Test user : ${Date.now()}`);
  // Send message from user A to Dragon(TC2)
  await sendNewMessage(
    windowA,
    testContactTwo.sessionid,
    `Test user -> Dragon (TC2): ${Date.now()}`
  );
  // Send message from Dragon to user A
  await sendNewMessage(windowC, testUser.sessionid, `Dragon (TC2) -> Test user : ${Date.now()}`);
  // Send message from user A to Fish(TC3)
  await sendNewMessage(
    windowA,
    testContactThree.sessionid,
    `Test user -> Fish (TC3): ${Date.now()}`
  );
  // Send message from Fish to user A
  await sendNewMessage(windowD, testUser.sessionid, `Fish (TC3) -> Test user : ${Date.now()}`);
  // Send message from user A to Gopher(TC4)
  await sendNewMessage(
    windowA,
    testContactFour.sessionid,
    `Test user -> Gopher (TC4): ${Date.now()}`
  );
  // Send message from Gopher to user A
  await sendNewMessage(windowE, testUser.sessionid, `Gopher (TC4) -> Test user : ${Date.now()}`);
});
