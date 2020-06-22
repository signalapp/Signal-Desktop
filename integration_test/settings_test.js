/* eslint-disable prefer-destructuring */
/* eslint-disable more/no-then */
/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */

const { after, before, describe, it } = require('mocha');
const common = require('./common');

const SettingsPage = require('./page-objects/settings.page');
const CommonPage = require('./page-objects/common.page');

// Generate random password
const password = Math.random()
  .toString(36)
  .substr(2, 8);
const passwordInputID = 'password-modal-input';

describe('Settings', function() {
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

  it('can toggle menubar', async () => {
    const menuBarVisible = await app.browserWindow.isMenuBarVisible();

    await app.client.element(SettingsPage.settingsButtonSection).click();
    await app.client
      .element(SettingsPage.settingToggleWithText('Hide Menu Bar'))
      .click();

    // Confirm that toggling works
    const menuBarToggled = await app.browserWindow.isMenuBarVisible();
    menuBarToggled.should.equal(!menuBarVisible);
  });

  it('can set password', async () => {
    await app.client
      .element(SettingsPage.settingsRowWithText('Privacy'))
      .click();

    await app.client
      .element(SettingsPage.settingButtonWithText('Set Password'))
      .click();

    await common.setValueWrapper(
      app,
      CommonPage.inputWithId(passwordInputID),
      password
    );
    await common.setValueWrapper(
      app,
      CommonPage.inputWithId(`${passwordInputID}-confirm`),
      password
    );

    await app.client.keys('Enter');

    // Verify password set
    await app.client.waitForExist(
      CommonPage.toastWithText('Set Password'),
      2000
    );

    await common.closeToast(app);
  });

  it('can remove password', async () => {
    // Enter password to unlock settings
    await common.setValueWrapper(
      app,
      CommonPage.inputWithId('password-lock-input'),
      password
    );

    await app.client.keys('Enter');

    // Remove password
    await app.client
      .element(SettingsPage.settingButtonWithText('Remove Password'))
      .click();

    await common.setValueWrapper(
      app,
      CommonPage.inputWithId(passwordInputID),
      password
    );

    await app.client.keys('Enter');

    // Verify password removed with toast
    await app.client.waitForExist(
      CommonPage.toastWithText('Removed Password'),
      2000
    );

    // Verify password actully removed
    await app.client.isExisting(
      CommonPage.divWithClass('session-settings__password-lock')
    ).should.eventually.be.false;
  });
});
