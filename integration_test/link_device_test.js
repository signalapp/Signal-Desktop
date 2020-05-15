/* eslint-disable prefer-destructuring */
/* eslint-disable more/no-then */
/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const { afterEach, beforeEach, describe, it } = require('mocha');
const common = require('./common');

describe('Link Device', function() {
  let app;
  let app2;
  this.timeout(60000);
  this.slow(15000);

  beforeEach(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();

    const app1Props = {
      mnemonic: common.TEST_MNEMONIC1,
      displayName: common.TEST_DISPLAY_NAME1,
    };

    const app2Props = {};

    [app, app2] = await Promise.all([
      common.startAndStub(app1Props),
      common.startAndStubN(app2Props, 2),
    ]);
  });

  afterEach(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();
  });

  it('linkDevice: link two desktop devices', async () => {
    await common.linkApp2ToApp(app, app2, common.TEST_PUBKEY1);
  });

  it('linkDevice: unlink two devices', async () => {
    await common.linkApp2ToApp(app, app2, common.TEST_PUBKEY1);
    await common.timeout(1000);
    await common.triggerUnlinkApp2FromApp(app, app2);
  });

  it('linkDevice:sync no groups, closed group, nor open groups', async () => {
    await common.linkApp2ToApp(app, app2, common.TEST_PUBKEY1);
    await common.timeout(2000);

    // get logs at this stage (getRenderProcessLogs() clears the app logs)
    const secondaryRenderLogs = await app2.client.getRenderProcessLogs();
    // pairing request message sent from secondary to primary pubkey
    await common.logsContains(
      secondaryRenderLogs,
      `Sending pairing-request:pairing-request message to ${
        common.TEST_PUBKEY1
      }`
    );

    const primaryRenderLogs = await app.client.getRenderProcessLogs();
    // primary grant pairing request
    await common.logsContains(
      primaryRenderLogs,
      'Sending pairing-request:pairing-request message to OUR SECONDARY PUBKEY'
    );

    // no friends, no closed groups, no open groups. we should see those message sync in the log
    await common.logsContains(primaryRenderLogs, 'No closed group to sync.', 1);
    await common.logsContains(primaryRenderLogs, 'No open groups to sync', 1);
    await common.logsContains(primaryRenderLogs, 'No contacts to sync.', 1);
  });
});
