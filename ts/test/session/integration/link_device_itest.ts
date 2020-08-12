/* eslint-disable prefer-destructuring */
/* eslint-disable more/no-then */
/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: no-implicit-dependencies
// tslint:disable: await-promise
// tslint:disable: no-invalid-this

import { afterEach, beforeEach, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';
import * as TestUtils from '../../test-utils/utils/stubbing';
import { expect } from 'chai';

describe('Link Device', function() {
  this.timeout(60000);
  this.slow(20000);
  let app: Application;
  let app2: Application;
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

  xit('linkDevice: link two desktop devices', async () => {
    await Common.linkApp2ToApp(app, app2, Common.TEST_PUBKEY1);
  });

  xit('linkDevice: unlink two devices', async () => {
    await Common.linkApp2ToApp(app, app2, Common.TEST_PUBKEY1);
    await Common.timeout(1000);
    await Common.triggerUnlinkApp2FromApp(app, app2);
  });

  xit('linkDevice:sync no groups, closed group, nor open groups', async () => {
    await TestUtils.spyMessageQueueSend(app);
    await TestUtils.spyMessageQueueSend(app2);

    await Common.linkApp2ToApp(app, app2, Common.TEST_PUBKEY1);
    await Common.timeout(10000);
    const allMessagesSentApp = await TestUtils.getAllMessagesSent(app);
    const allMessagesSentApp2 = await TestUtils.getAllMessagesSent(app2);

    expect(allMessagesSentApp2[0][1]).to.have.property('requestSignature');
    expect(allMessagesSentApp2[0][1]).to.have.property(
      'primaryDevicePubKey',
      Common.TEST_PUBKEY1
    );
    expect(allMessagesSentApp2[0][1]).to.have.property('secondaryDevicePubKey');

    expect(allMessagesSentApp[1][1]).to.have.property('requestSignature');
    expect(allMessagesSentApp[1][1]).to.have.property('grantSignature');
    expect(allMessagesSentApp[1][1]).to.have.property(
      'displayName',
      Common.TEST_DISPLAY_NAME1
    );
    expect(allMessagesSentApp[1][1]).to.have.property(
      'primaryDevicePubKey',
      Common.TEST_PUBKEY1
    );
    expect(allMessagesSentApp[1][1]).to.have.property('secondaryDevicePubKey');

    // one message for session establishment, one for grant authorization. No group or anything to sync
    expect(allMessagesSentApp.length).to.be.equal(2);
  });
});
