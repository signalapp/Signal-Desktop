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
      stubSnode: true,
    };

    const app2Props = {
      stubSnode: true,
    };

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
});
