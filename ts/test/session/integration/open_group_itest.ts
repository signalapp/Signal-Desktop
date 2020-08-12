/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: await-promise
// tslint:disable: no-implicit-dependencies
// tslint:disable: no-invalid-this

import { afterEach, beforeEach, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';

import ConversationPage from './page-objects/conversation.page';

describe('Open groups', function() {
  this.timeout(60000);
  this.slow(20000);
  let app: Application;

  beforeEach(async () => {
    await Common.killallElectron();
    const login = {
      mnemonic: Common.TEST_MNEMONIC1,
      displayName: Common.TEST_DISPLAY_NAME1,
    };
    app = await Common.startAndStub(login);
  });

  afterEach(async () => {
    await Common.killallElectron();
  });

  it('openGroup: works with valid open group url', async () => {
    await Common.joinOpenGroup(
      app,
      Common.VALID_GROUP_URL,
      Common.VALID_GROUP_NAME
    );
  });

  it('openGroup: cannot join two times the same open group', async () => {
    await Common.joinOpenGroup(
      app,
      Common.VALID_GROUP_URL2,
      Common.VALID_GROUP_NAME2
    );

    // adding a second time the same open group
    await app.client
      .element(ConversationPage.conversationButtonSection)
      .click();
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await Common.setValueWrapper(
      app,
      ConversationPage.openGroupInputUrl,
      Common.VALID_GROUP_URL2
    );
    await app.client.element(ConversationPage.joinOpenGroupButton).click();
    // validate session loader is not shown
    await app.client.isExisting(ConversationPage.sessionLoader).should
      .eventually.be.false;

    await app.client.waitForExist(
      ConversationPage.sessionToastJoinOpenGroupAlreadyExist,
      1 * 1000
    );

    // validate overlay is still opened as connection failed
    await app.client.isExisting(ConversationPage.leftPaneOverlay).should
      .eventually.be.true;
  });

  it('openGroup: can send message to open group', async () => {
    // join dev-chat group
    await app.client
      .element(ConversationPage.conversationButtonSection)
      .click();
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await Common.setValueWrapper(
      app,
      ConversationPage.openGroupInputUrl,
      Common.VALID_GROUP_URL2
    );
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    // wait for toast to appear
    await app.client.waitForExist(
      ConversationPage.sessionToastJoinOpenGroupSuccess,
      30 * 1000
    );
    await Common.timeout(5 * 1000); // wait for toast to clear

    await app.client.waitForExist(
      ConversationPage.rowOpenGroupConversationName(Common.VALID_GROUP_NAME2),
      10 * 1000
    );
    // generate a message containing the current timestamp so we can find it in the list of messages
    const textMessage = Common.generateSendMessageText();
    await app.client
      .element(ConversationPage.conversationButtonSection)
      .click();

    await app.client.isExisting(
      ConversationPage.rowOpenGroupConversationName(Common.VALID_GROUP_NAME2)
    );

    await app.client
      .element(
        ConversationPage.rowOpenGroupConversationName(Common.VALID_GROUP_NAME2)
      )
      .click();

    await Common.setValueWrapper(
      app,
      ConversationPage.sendMessageTextarea,
      textMessage
    );
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .getValue()
      .should.eventually.equal(textMessage);
    // allow some time to fetch some messages
    await Common.timeout(3000);

    // send the message
    await app.client.keys('Enter');
    await Common.timeout(5000);
    // validate that the message has been added to the message list view
    await app.client.waitForExist(
      ConversationPage.existingSendMessageText(textMessage),
      3 * 1000
    );
    // we should validate that the message has been added effectively sent
    // (checking the check icon on the metadata part of the message?)
  });
});
