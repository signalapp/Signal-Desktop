/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: no-implicit-dependencies
// tslint:disable: await-promise
// tslint:disable: no-invalid-this

import { afterEach, beforeEach, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';

import SettingsPage from './page-objects/settings.page';
import RegistrationPage from './page-objects/registration.page';
import ConversationPage from './page-objects/conversation.page';

describe('Window Test and Login', function() {
  this.timeout(60000);
  this.slow(20000);
  let app: Application;

  beforeEach(async () => {
    await Common.killallElectron();
  });

  afterEach(async () => {
    await Common.stopApp(app);
    await Common.killallElectron();
  });

  it('registration: opens one window', async () => {
    app = await Common.startAndAssureCleanedApp();
    app.client.getWindowCount().should.eventually.be.equal(1);
  });

  it('registration: window title is correct', async () => {
    app = await Common.startAndAssureCleanedApp();

    app.client.getTitle().should.eventually.be.equal('Session - test-integration-session');
  });

  it('registration: can restore from seed', async () => {
    app = await Common.startAndAssureCleanedApp();

    await app.client.element(RegistrationPage.registrationTabSignIn).click();
    await app.client.element(RegistrationPage.restoreFromSeedMode).click();
    await app.client
      .element(RegistrationPage.recoveryPhraseInput)
      .setValue(Common.TEST_RECOVERY_PHRASE_1);
    await app.client.element(RegistrationPage.displayNameInput).setValue(Common.TEST_DISPLAY_NAME1);

    // validate fields are filled
    await app.client
      .element(RegistrationPage.recoveryPhraseInput)
      .getValue()
      .should.eventually.equal(Common.TEST_RECOVERY_PHRASE_1);
    await app.client
      .element(RegistrationPage.displayNameInput)
      .getValue()
      .should.eventually.equal(Common.TEST_DISPLAY_NAME1);

    // trigger login
    await app.client.element(RegistrationPage.continueSessionButton).click();
    await app.client.waitForExist(RegistrationPage.conversationListContainer, 4000);

    await Common.timeout(2000);

    await app.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(Common.TEST_PUBKEY1);
  });

  it('registration: can create new account', async () => {
    app = await Common.startAndAssureCleanedApp();
    await app.client.element(RegistrationPage.createSessionIDButton).click();
    // wait for the animation of generated pubkey to finish
    await Common.timeout(2000);
    const pubkeyGenerated = await app.client
      .element(RegistrationPage.textareaGeneratedPubkey)
      .getValue();
    // validate generated pubkey
    pubkeyGenerated.should.have.lengthOf(66);
    pubkeyGenerated.substr(0, 2).should.be.equal('05');
    await app.client.element(RegistrationPage.continueButton).click();
    await app.client.isExisting(RegistrationPage.displayNameInput).should.eventually.be.true;
    await app.client.element(RegistrationPage.displayNameInput).setValue(Common.TEST_DISPLAY_NAME1);
    await app.client.element(RegistrationPage.getStartedButton).click();
    await app.client.waitForExist(ConversationPage.conversationButtonSection, 5000);

    await app.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(pubkeyGenerated);
  });

  it('registration: can delete account when logged in', async () => {
    // login as user1
    const login = {
      recoveryPhrase: Common.TEST_RECOVERY_PHRASE_1,
      displayName: Common.TEST_DISPLAY_NAME1,
    };
    app = await Common.startAndStub(login);

    await app.client.waitForExist(RegistrationPage.conversationListContainer, 4000);

    await app.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(Common.TEST_PUBKEY1);
    // delete account
    await app.client.element(SettingsPage.settingsButtonSection).click();
    await app.client.element(ConversationPage.deleteAccountButton).click();
    await app.client.isExisting(ConversationPage.descriptionDeleteAccount).should.eventually.be
      .true;
    // click on the modal OK button to delete the account
    await app.client.element(ConversationPage.validateDeleteAccount).click();
    // wait for the app restart
    await Common.timeout(2000);

    // Spectron will loose the connection with the app during the app restart.
    // We have to restart the app without altering the logged in user or anything here, just to get a valid new ref to the app.
    await Common.stopApp(app);
    app = await Common.startApp();

    // validate that on app start, the registration sign in is shown
    await app.client.waitForExist(RegistrationPage.registrationTabSignIn, 3000);
    // validate that no pubkey are set in storage
    await app.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(null);
    // and that the conversation list is not shown
    await app.client.isExisting(RegistrationPage.conversationListContainer).should.eventually.be
      .false;
  });
});
