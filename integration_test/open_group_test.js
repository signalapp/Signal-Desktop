/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const common = require('./common');
const { afterEach, beforeEach, describe, it } = require('mocha');
const ConversationPage = require('./page-objects/conversation.page');

describe('Open groups', function() {
  let app;
  this.timeout(30000);
  this.slow(15000);

  beforeEach(async () => {
    await common.killallElectron();
    const login = {
      mnemonic: common.TEST_MNEMONIC1,
      displayName: common.TEST_DISPLAY_NAME1,
      stubOpenGroups: true,
    };
    app = await common.startAndStub(login);
  });

  afterEach(async () => {
    await common.killallElectron();
  });

  it('works with valid group url', async () => {
    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await app.client
      .element(ConversationPage.openGroupInputUrl)
      .setValue(common.VALID_GROUP_URL);
    await app.client
      .element(ConversationPage.openGroupInputUrl)
      .getValue()
      .should.eventually.equal(common.VALID_GROUP_URL);
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    // validate session loader is shown
    await app.client.isExisting(ConversationPage.sessionLoader);
    await app.client.waitForExist(
      ConversationPage.sessionToastJoinOpenGroupSuccess,
      9000
    );

    // validate overlay is closed
    await app.client
      .isExisting(ConversationPage.leftPaneOverlay)
      .should.eventually.be.equal(false);

    // validate open chat has been added
    await app.client.waitForExist(
      ConversationPage.rowOpenGroupConversationName(common.VALID_GROUP_NAME),
      4000
    );

    await common.timeout(1000);
  });

  it('cannot join two times the same open group', async () => {
    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await app.client
      .element(ConversationPage.openGroupInputUrl)
      .setValue(common.VALID_GROUP_URL2);
    await app.client.element(ConversationPage.joinOpenGroupButton).click();
    // first add is a success
    await common.timeout(2000);
    await app.client.waitForExist(
      ConversationPage.rowOpenGroupConversationName(common.VALID_GROUP_NAME2),
      8000
    );

    // adding a second time the same open group
    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await app.client
      .element(ConversationPage.openGroupInputUrl)
      .setValue(common.VALID_GROUP_URL2);
    await app.client.element(ConversationPage.joinOpenGroupButton).click();
    // validate session loader is not shown
    await app.client
      .isExisting(ConversationPage.sessionLoader)
      .should.eventually.be.equal(false);

    await app.client.waitForExist(
      ConversationPage.sessionToastJoinOpenGroupAlreadyExist,
      1000
    );

    // validate overlay is still opened
    await app.client
      .isExisting(ConversationPage.leftPaneOverlay)
      .should.eventually.be.equal(true);
  });

  it('can send message to open group', async () => {
    // join dev-chat group
    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await app.client
      .element(ConversationPage.openGroupInputUrl)
      .setValue(common.VALID_GROUP_URL2);
    await app.client.element(ConversationPage.joinOpenGroupButton).click();
    // first add is a success
    await common.timeout(2000);
    await app.client.waitForExist(
      ConversationPage.rowOpenGroupConversationName(common.VALID_GROUP_NAME2),
      8000
    );
    // generate a message containing the current timestamp so we can find it in the list of messages
    const textMessage = common.generateSendMessageText();
    await app.client
      .element(ConversationPage.conversationButtonSection)
      .click();

    await app.client.isExisting(
      ConversationPage.rowOpenGroupConversationName(common.VALID_GROUP_NAME2)
    );
    await app.client
      .element(
        ConversationPage.rowOpenGroupConversationName(common.VALID_GROUP_NAME2)
      )
      .click();
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .setValue(textMessage);
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .getValue()
      .should.eventually.equal(textMessage);
    // allow some time to fetch some messages
    await common.timeout(3000);

    // send the message
    await app.client.keys('Enter');
    await common.timeout(5000);
    // validate that the message has been added to the message list view
    await app.client.waitForExist(
      ConversationPage.existingSendMessageText(textMessage),
      3000
    );
    // we should validate that the message has been added effectively sent
    // (checking the check icon on the metadata part of the message?)
  });
});
