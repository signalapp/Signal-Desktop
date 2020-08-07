/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: await-promise
// tslint:disable: no-implicit-dependencies
// tslint:disable: no-invalid-this

import { after, before, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';

describe('Message Syncing', function() {
  this.timeout(60000);
  this.slow(20000);
  let Alice1: Application;
  let Bob1: Application;
  let Alice2: Application;

  // this test suite builds a complex usecase over several tests,
  // so you need to run all of those tests together (running only one might fail)
  before(async () => {
    await Common.killallElectron();
    await Common.stopStubSnodeServer();

    const alice2Props = {};

    [Alice1, Bob1] = await Common.startAppsAsFriends(); // Alice and Bob are friends

    await Common.addFriendToNewClosedGroup([Alice1, Bob1], false);
    await Common.joinOpenGroup(
      Alice1,
      Common.VALID_GROUP_URL,
      Common.VALID_GROUP_NAME
    );

    Alice2 = await Common.startAndStubN(alice2Props, 4); // Alice secondary, just start the app for now. no linking
  });

  after(async () => {
    await Common.killallElectron();
    await Common.stopStubSnodeServer();
  });

  xit('message syncing with 1 friend, 1 closed group, 1 open group', async () => {
    // Alice1 has:
    //  *  no linked device
    //  *  Bob is a friend
    //  *  one open group
    //  *  one closed group with Bob inside

    // Bob1 has:
    //  *  no linked device
    //  *  Alice as a friend
    //  *  one open group with Alice

    // Linking Alice2 to Alice1
    // alice2 should trigger auto FR with bob1 as it's one of her friend
    // and alice2 should trigger a FALLBACK_MESSAGE with bob1 as he is in a closed group with her
    await Common.linkApp2ToApp(Alice1, Alice2, Common.TEST_PUBKEY1);
    await Common.timeout(25000);

    // validate pubkey of app2 is the set
    const alice2Pubkey = await Alice2.webContents.executeJavaScript(
      'window.textsecure.storage.user.getNumber()'
    );
    alice2Pubkey.should.have.lengthOf(66);

    const alice1Logs = await Alice1.client.getRenderProcessLogs();
    const bob1Logs = await Bob1.client.getRenderProcessLogs();
    const alice2Logs = await Alice2.client.getRenderProcessLogs();

    // validate primary alice
    await Common.logsContains(
      alice1Logs,
      'Sending closed-group-sync-send:outgoing message to OUR SECONDARY PUBKEY',
      1
    );
    await Common.logsContains(
      alice1Logs,
      'Sending open-group-sync-send:outgoing message to OUR SECONDARY PUBKEY',
      1
    );
    await Common.logsContains(
      alice1Logs,
      'Sending contact-sync-send:outgoing message to OUR SECONDARY PUBKEY',
      1
    );

    // validate secondary alice
    // what is expected is
    // alice2 receives group sync, contact sync and open group sync
    // alice2 triggers session request with closed group members and autoFR with contact sync received
    // once autoFR is auto-accepted, alice2 trigger contact sync
    await Common.logsContains(
      alice2Logs,
      'Got sync group message with group id',
      1
    );
    await Common.logsContains(
      alice2Logs,
      'Received GROUP_SYNC with open groups: [chat.getsession.org]',
      1
    );
    await Common.logsContains(
      alice2Logs,
      `Sending auto-friend-request:friend-request message to ${Common.TEST_PUBKEY2}`,
      1
    );
    await Common.logsContains(
      alice2Logs,
      `Sending session-request:friend-request message to ${Common.TEST_PUBKEY2}`,
      1
    );
    await Common.logsContains(
      alice2Logs,
      'Sending contact-sync-send:outgoing message to OUR_PRIMARY_PUBKEY',
      1
    );

    // validate primary bob
    // what is expected is
    // bob1 receives session request from alice2
    // bob1 accept auto fr by sending a bg message
    // once autoFR is auto-accepted, alice2 trigger contact sync
    await Common.logsContains(
      bob1Logs,
      `Received FALLBACK_MESSAGE from source: ${alice2Pubkey}`,
      1
    );
    await Common.logsContains(
      bob1Logs,
      `Received AUTO_FRIEND_REQUEST from source: ${alice2Pubkey}`,
      1
    );
    await Common.logsContains(
      bob1Logs,
      `Sending auto-friend-accept:onlineBroadcast message to ${alice2Pubkey}`,
      1
    );
    // be sure only one autoFR accept was sent (even if multi device, we need to reply to that specific device only)
    await Common.logsContains(
      bob1Logs,
      'Sending auto-friend-accept:onlineBroadcast message to',
      1
    );
  });
});
