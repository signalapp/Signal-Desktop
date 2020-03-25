/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */

const common = require('./common');
const { afterEach, beforeEach, describe, it } = require('mocha');
const RegistrationPage = require('./page-objects/registration.page');
const ConversationPage = require('./page-objects/conversation.page');

describe('Window Test and Login', function() {
  let app;
  this.timeout(20000);
  this.slow(15000);

  beforeEach(async () => {
    await common.killallElectron();
  });

  afterEach(async () => {
    await common.stopApp(app);
    await common.killallElectron();
  });

  it('opens one window', async () => {
    app = await common.startAndAssureCleanedApp();
    app.client.getWindowCount().should.eventually.be.equal(1);
  });

  it('window title is correct', async () => {
    app = await common.startAndAssureCleanedApp();

    app.client
      .getTitle()
      .should.eventually.be.equal('Session - test-integration-session');
  });

  it('can restore from seed', async () => {
    app = await common.startAndAssureCleanedApp();

    await app.client.element(RegistrationPage.registrationTabSignIn).click();
    await app.client.element(RegistrationPage.restoreFromSeedMode).click();
    await app.client
      .element(RegistrationPage.recoveryPhraseInput)
      .setValue(common.TEST_MNEMONIC1);
    await app.client
      .element(RegistrationPage.displayNameInput)
      .setValue(common.TEST_DISPLAY_NAME1);

    // validate fields are filled
    await app.client
      .element(RegistrationPage.recoveryPhraseInput)
      .getValue()
      .should.eventually.equal(common.TEST_MNEMONIC1);
    await app.client
      .element(RegistrationPage.displayNameInput)
      .getValue()
      .should.eventually.equal(common.TEST_DISPLAY_NAME1);

    // trigger login
    await app.client.element(RegistrationPage.continueSessionButton).click();
    await app.client.waitForExist(
      RegistrationPage.conversationListContainer,
      4000
    );

    await common.timeout(2000);

    await app.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(common.TEST_PUBKEY1);
  });

  it('can create new account', async () => {
    app = await common.startAndAssureCleanedApp();
    await app.client.element(RegistrationPage.createSessionIDButton).click();
    // wait for the animation of generated pubkey to finish
    await common.timeout(2000);
    const pubkeyGenerated = await app.client
      .element(RegistrationPage.textareaGeneratedPubkey)
      .getValue();
    // validate generated pubkey
    pubkeyGenerated.should.have.lengthOf(66);
    pubkeyGenerated.substr(0, 2).should.be.equal('05');
    await app.client.element(RegistrationPage.continueButton).click();
    await app.client.isExisting(RegistrationPage.displayNameInput);
    await app.client
      .element(RegistrationPage.displayNameInput)
      .setValue(common.TEST_DISPLAY_NAME1);
    await app.client.element(RegistrationPage.getStartedButton).click();
    await app.client.waitForExist(
      ConversationPage.conversationButtonSection,
      5000
    );

    await app.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(pubkeyGenerated);
  });

  it('can delete account when logged in', async () => {
    // login as user1
    const login = {
      mnemonic: common.TEST_MNEMONIC1,
      displayName: common.TEST_DISPLAY_NAME1,
      stubOpenGroups: true,
    };
    app = await common.startAndStub(login);

    await app.client.waitForExist(
      RegistrationPage.conversationListContainer,
      4000
    );

    await app.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(common.TEST_PUBKEY1);
    // delete account
    await app.client.element(ConversationPage.settingsButtonSection).click();
    await app.client.element(ConversationPage.deleteAccountButton).click();
    await app.client.isExisting(ConversationPage.descriptionDeleteAccount);
    // click on the modal OK button to delete the account
    await app.client.element(ConversationPage.validateDeleteAccount).click();
    // wait for the app restart
    await common.timeout(2000);

    // Spectron will loose the connection with the app during the app restart.
    // We have to restart the app without altering the logged in user or anything here, just to get a valid new ref to the app.
    await common.stopApp(app);
    app = await common.startApp();

    // validate that on app start, the registration sign in is shown
    await app.client.waitForExist(RegistrationPage.registrationTabSignIn, 3000);
    // validate that no pubkey are set in storage
    await app.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(null);
    // and that the conversation list is not shown
    await app.client.isExisting(RegistrationPage.conversationListContainer)
      .should.eventually.be.false;
  });
});
