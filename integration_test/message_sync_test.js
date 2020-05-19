/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const { after, before, describe, it } = require('mocha');

const common = require('./common');

describe('Message Syncing', function() {
  let Alice1;
  let Bob1;
  let Alice2;
  this.timeout(60000);
  this.slow(15000);

  // this test suite builds a complex usecase over several tests,
  // so you need to run all of those tests together (running only one might fail)
  before(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();

    const alice2Props = {};

    [Alice1, Bob1] = await common.startAppsAsFriends(); // Alice and Bob are friends

    await common.addFriendToNewClosedGroup(Alice1, Bob1);
    await common.joinOpenGroup(
      Alice1,
      common.VALID_GROUP_URL,
      common.VALID_GROUP_NAME
    );

    Alice2 = await common.startAndStubN(alice2Props, 4); // Alice secondary, just start the app for now. no linking
  });

  after(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();
  });

  it('message syncing', async () => {
    // Alice1 has:
    //  *  no linked device
    //  *  Bob is a friend
    //  *  one open group
    //  *  one closed group with Bob inside

    // Bob1 has:
    //  *  no linked device
    //  *  Alice as a friend
    //  *  one open group with Alice

    await common.linkApp2ToApp(Alice1, Alice2, common.TEST_PUBKEY1);
    await common.timeout(12000);

    // validate primary pubkey of app2 is the same that in app1
    const alice2Pubkey = await Alice2.webContents.executeJavaScript(
      'window.textsecure.storage.user.getNumber()'
    );
    alice2Pubkey.should.have.lengthOf(66);

    const alice1Logs = await Alice1.client.getRenderProcessLogs();
    const bob1Logs = await Bob1.client.getRenderProcessLogs();
    const alice2Logs = await Alice2.client.getRenderProcessLogs();

    // validate primary alice
    await common.logsContains(
      alice1Logs,
      'Sending closed-group-sync-send:outgoing message to OUR SECONDARY PUBKEY',
      1
    );
    await common.logsContains(
      alice1Logs,
      'Sending open-group-sync-send:outgoing message to OUR SECONDARY PUBKEY',
      1
    );
    await common.logsContains(
      alice1Logs,
      'Sending contact-sync-send:outgoing message to OUR SECONDARY PUBKEY',
      1
    );

    // validate secondary alice
    // what is expected is
    // alice2 receives group sync, contact sync and open group sync
    // alice2 triggers session request with closed group members and autoFR with contact sync received
    // once autoFR is auto-accepted, alice2 trigger contact sync
    await common.logsContains(
      alice2Logs,
      'Got sync group message with group id',
      1
    );
    await common.logsContains(
      alice2Logs,
      'Received GROUP_SYNC with open groups: [chat.getsession.org]',
      1
    );
    await common.logsContains(
      alice2Logs,
      `Sending auto-friend-request:onlineBroadcast message to ${
        common.TEST_PUBKEY2
      }`,
      1
    );
    await common.logsContains(
      alice2Logs,
      `Sending session-request:friend-request message to ${
        common.TEST_PUBKEY2
      }`,
      1
    );
    await common.logsContains(
      alice2Logs,
      `Sending contact-sync-send:outgoing message to OUR_PRIMARY_PUBKEY`,
      1
    );

    // validate primary bob
    // what is expected is
    // bob1 receives session request from alice2
    // bob1 accept auto fr by sending a bg message
    // once autoFR is auto-accepted, alice2 trigger contact sync
    await common.logsContains(
      bob1Logs,
      `Received SESSION_REQUEST from source: ${alice2Pubkey}`,
      1
    );
    await common.logsContains(
      bob1Logs,
      `Received AUTO_FRIEND_REQUEST from source: ${alice2Pubkey}`,
      1
    );
    await common.logsContains(
      bob1Logs,
      `Sending auto-friend-accept:onlineBroadcast message to ${alice2Pubkey}`,
      1
    );
    // be sure only one autoFR accept was sent (even if multi device, we need to reply to that specific device only)
    // FIXME happens 2 times await common.logsContains(bob1Logs, `Sending auto-friend-accept:onlineBroadcast message to`, 1);
    await common.logsContains(
      bob1Logs,
      `Sending session-request-accepted:onlineBroadcast message to ${alice2Pubkey}`,
      1
    );
    // be sure only one session request accept was sent (even if multi device, we need to reply to that specific device only)
    // FIXME happens 2 times  await common.logsContains(bob1Logs, `Sending session-request-accepted:onlineBroadcast message to`, 1);
  });
});
