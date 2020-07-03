/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const { afterEach, beforeEach, describe, it } = require('mocha');

const common = require('./common');
const ConversationPage = require('./page-objects/conversation.page');

describe('Add friends', function() {
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

    const app2Props = {
      mnemonic: common.TEST_MNEMONIC2,
      displayName: common.TEST_DISPLAY_NAME2,
    };

    [app, app2] = await Promise.all([
      common.startAndStub(app1Props),
      common.startAndStubN(app2Props, 2),
    ]);
  });

  afterEach(async () => {
    await common.stopApp(app);
    await common.killallElectron();
    await common.stopStubSnodeServer();
  });

  it('addFriends: can add a friend by sessionID', async () => {
    const textMessage = common.generateSendMessageText();

    await app.client.element(ConversationPage.contactsButtonSection).click();
    await app.client.element(ConversationPage.addContactButton).click();
    await app.client.isExisting(ConversationPage.leftPaneOverlay).should
      .eventually.be.true;

    await common.setValueWrapper(
      app,
      ConversationPage.sessionIDInput,
      common.TEST_PUBKEY2
    );
    await app.client
      .element(ConversationPage.sessionIDInput)
      .getValue()
      .should.eventually.equal(common.TEST_PUBKEY2);

    await app.client.element(ConversationPage.nextButton).click();
    await app.client.waitForExist(ConversationPage.sendMessageTextarea, 1000);

    // send a text message to that user (will be a friend request)
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .setValue(textMessage);
    await app.client.keys('Enter');
    await app.client.waitForExist(
      ConversationPage.existingSendMessageText(textMessage),
      1000
    );

    // assure friend request message has been sent
    await common.timeout(3000);
    await app.client.isExisting(ConversationPage.retrySendButton).should
      .eventually.be.false;

    await app2.client.waitForExist(ConversationPage.conversationItem, 5000);

    await app2.client.element(ConversationPage.conversationItem).click();

    await app2.client.waitForExist(
      ConversationPage.existingReceivedMessageText(textMessage),
      1000
    );
  });
});
