/* eslint-disable prefer-destructuring */
/* eslint-disable more/no-then */
/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: no-implicit-dependencies
import { afterEach, beforeEach, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';

describe('Link Device', function() {
  let app: Application;
  let app2: Application;
  this.timeout(60000);
  this.slow(15000);

  beforeEach(async () => {
    await Common.killallElectron();

    const app1Props = {
      mnemonic: Common.TEST_MNEMONIC1,
      displayName: Common.TEST_DISPLAY_NAME1,
    };

    const app2Props = {};

    [app, app2] = await Promise.all([
      Common.startAndStub(app1Props),
      Common.startAndStubN(app2Props, 2),
    ]);
  });

  afterEach(async () => {
    await Common.killallElectron();
  });

  it('linkDevice: link two desktop devices', async () => {
    await Common.linkApp2ToApp(app, app2, Common.TEST_PUBKEY1);
  });

  it('linkDevice: unlink two devices', async () => {
    await Common.linkApp2ToApp(app, app2, Common.TEST_PUBKEY1);
    await Common.timeout(1000);
    await Common.triggerUnlinkApp2FromApp(app, app2);
  });

  it('linkDevice:sync no groups, closed group, nor open groups', async () => {
    await Common.linkApp2ToApp(app, app2, Common.TEST_PUBKEY1);
    await Common.timeout(10000);

    // get logs at this stage (getRenderProcessLogs() clears the app logs)
    const secondaryRenderLogs = await app2.client.getRenderProcessLogs();
    // pairing request message sent from secondary to primary pubkey
    await Common.logsContains(
      secondaryRenderLogs,
      `Sending pairing-request:pairing-request message to ${Common.TEST_PUBKEY1}`
    );

    const primaryRenderLogs = await app.client.getRenderProcessLogs();
    // primary grant pairing request
    await Common.logsContains(
      primaryRenderLogs,
      'Sending pairing-request:pairing-request message to OUR SECONDARY PUBKEY'
    );

    // no friends, no closed groups, no open groups. we should see those message sync in the log
    await Common.logsContains(primaryRenderLogs, 'No closed group to sync.', 1);
    await Common.logsContains(primaryRenderLogs, 'No open groups to sync', 1);
    await Common.logsContains(primaryRenderLogs, 'No contacts to sync.', 1);
  });
});
