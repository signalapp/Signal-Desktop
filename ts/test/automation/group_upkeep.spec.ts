import { _electron, Page, test } from '@playwright/test';
import { beforeAllClean } from './setup/beforeEach';
import { openApp } from './setup/new_user';
import { sendNewMessage } from './utilities/send_message';
import { logIn } from './setup/log_in';
import { userA, userB, userC, userD, userE } from './setup/test_user';

let windows: Array<Page> = [];
test.beforeEach(beforeAllClean);

test.skip('Group upkeep', async () => {
  const [windowA, windowB, windowC, windowD, windowE] = await openApp(5);
  windows = [windowA, windowB, windowC, windowD, windowE];
  await Promise.all([
    logIn(windowA, userA.recoveryPhrase),
    logIn(windowB, userB.recoveryPhrase),
    logIn(windowC, userC.recoveryPhrase),
    logIn(windowD, userD.recoveryPhrase),
    logIn(windowE, userE.recoveryPhrase),
  ]);
  // Send message from test users to all of it's contacts to maintain contact status

  // Send message from user A to Whale(TC1)
  await sendNewMessage(
    windowA,
    userB.sessionid,
    `${userA.userName} -> ${userB.userName}: ${Date.now()}`
  );
  // Send message from Whale to user A
  await sendNewMessage(
    windowB,
    userA.sessionid,
    `${userB.userName} -> ${userA.userName} : ${Date.now()}`
  );
  // Send message from user A to Dragon(TC2)
  await sendNewMessage(
    windowA,
    userC.sessionid,
    `${userA.userName} -> ${userC.userName}: ${Date.now()}`
  );
  // Send message from Dragon to user A
  await sendNewMessage(
    windowC,
    userA.sessionid,
    `${userC.userName} -> ${userA.userName} : ${Date.now()}`
  );
  // Send message from user A to Fish(TC3)
  await sendNewMessage(
    windowA,
    userD.sessionid,
    `${userA.userName} -> ${userD.userName}: ${Date.now()}`
  );
  // Send message from Fish to user A
  await sendNewMessage(
    windowD,
    userA.sessionid,
    `${userD.userName} -> ${userA.userName} : ${Date.now()}`
  );
  // Send message from user A to Gopher(TC4)
  await sendNewMessage(
    windowA,
    userE.sessionid,
    `${userA.userName} -> ${userD.userName}: ${Date.now()}`
  );
  // Send message from Gopher to user A
  await sendNewMessage(
    windowE,
    userA.sessionid,
    `${userD.userName} -> ${userA.userName} : ${Date.now()}`
  );
});
