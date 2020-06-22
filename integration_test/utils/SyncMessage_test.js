/* eslint-disable prefer-destructuring */
/* eslint-disable more/no-then */
/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */

const { after, before, describe, it } = require('mocha');
const common = require('../common');

const libsession = require('../../ts/session');

describe('SyncMessage Utils', function() {
  let app;
  this.timeout(60000);
  this.slow(15000);

  before(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();

    const appProps = {
      mnemonic: common.TEST_MNEMONIC1,
      displayName: common.TEST_DISPLAY_NAME1,
    };

    app = await common.startAndStub(appProps);
  });
  

  after(async () => {
    await common.stopApp(app);
    await common.killallElectron();
    await common.stopStubSnodeServer();
  });

  
  describe('getSyncContacts', async () => {
    it('can get sync contacts', async () => {
      const contacts = libsession.Protocols.SessionProtocol.
      
      // const menuBarVisible = await app.browserWindow.isMenuBarVisible();
  
      // await app.client.element(SettingsPage.settingsButtonSection).click();
      // await app.client
      //   .element(SettingsPage.settingToggleWithText('Hide Menu Bar'))
      //   .click();
  
      // // Confirm that toggling works
      // const menuBarToggled = await app.browserWindow.isMenuBarVisible();
      // menuBarToggled.should.equal(!menuBarVisible);
    });
  });


  

});
