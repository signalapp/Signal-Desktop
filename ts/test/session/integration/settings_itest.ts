/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: await-promise
// tslint:disable: no-implicit-dependencies
// tslint:disable: no-invalid-this

import { after, before, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';

import SettingsPage from './page-objects/settings.page';
import CommonPage from './page-objects/common.page';

// Generate random password
// tslint:disable-next-line: insecure-random
const password = Math.random()
  .toString(36)
  .substr(2, 8);
const passwordInputID = 'password-modal-input';

describe('Settings', function() {
  this.timeout(60000);
  this.slow(20000);
  let app: Application;

  before(async () => {
    await Common.killallElectron();
    await Common.stopStubSnodeServer();

    const appProps = {
      recoveryPhrase: Common.TEST_RECOVERY_PHRASE_1,
      displayName: Common.TEST_DISPLAY_NAME1,
    };

    app = await Common.startAndStub(appProps);
  });

  after(async () => {
    await Common.stopApp(app);
    await Common.killallElectron();
    await Common.stopStubSnodeServer();
  });

  it('settings: can toggle menubar', async () => {
    const menuBarVisible = await app.browserWindow.isMenuBarVisible();

    await app.client.element(SettingsPage.settingsButtonSection).click();
    await app.client.element(SettingsPage.settingToggleWithText('Hide Menu Bar')).click();

    // Confirm that toggling works
    const menuBarToggled = await app.browserWindow.isMenuBarVisible();
    menuBarToggled.should.equal(!menuBarVisible);
  });

  it('settings: can set password', async () => {
    await app.client.element(SettingsPage.settingsRowWithText('Privacy')).click();

    await app.client.element(SettingsPage.settingButtonWithText('Set Password')).click();

    await Common.setValueWrapper(app, CommonPage.inputWithId(passwordInputID), password);
    await Common.setValueWrapper(
      app,
      CommonPage.inputWithId(`${passwordInputID}-confirm`),
      password
    );

    await app.client.keys('Enter');

    // Verify password set
    await app.client.waitForExist(CommonPage.toastWithText('Set Password'), 2000);

    await Common.closeToast(app);
  });

  it('settings: can remove password', async () => {
    // Enter password to unlock settings
    await Common.setValueWrapper(app, CommonPage.inputWithId('password-lock-input'), password);

    await app.client.keys('Enter');

    // Remove password
    await app.client.element(SettingsPage.settingButtonWithText('Remove Password')).click();

    await Common.setValueWrapper(app, CommonPage.inputWithId(passwordInputID), password);

    await app.client.keys('Enter');

    // Verify password removed with toast
    await app.client.waitForExist(CommonPage.toastWithText('Removed Password'), 2000);

    // Verify password actully removed
    await app.client.isExisting(CommonPage.divWithClass('session-settings__password-lock')).should
      .eventually.be.false;
  });
});
