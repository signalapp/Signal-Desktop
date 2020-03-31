/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const common = require('./common');
const { afterEach, beforeEach, describe, it } = require('mocha');
const ConversationPage = require('./page-objects/conversation.page');

describe('Closed groups', function() {
  let app;
  let app2;
  this.timeout(60000);
  this.slow(15000);

  beforeEach(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();

    [app, app2] = await common.startAppsAsFriends();
  });

  afterEach(async () => {
    await common.stopApp(app);
    await common.killallElectron();
    await common.stopStubSnodeServer();
  });

  it('can create a closed group with a friend and send/receive a message', async () => {
    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.createClosedGroupButton).click();

    // fill the groupname
    await app.client
      .element(ConversationPage.closedGroupNameTextarea)
      .setValue(common.VALID_CLOSED_GROUP_NAME1);
    await app.client
      .element(ConversationPage.closedGroupNameTextarea)
      .getValue()
      .should.eventually.equal(common.VALID_CLOSED_GROUP_NAME1);

    await app.client
      .element(ConversationPage.createClosedGroupMemberItem)
      .isVisible();

    // select the first friend as a member of the groups being created
    await app.client
      .element(ConversationPage.createClosedGroupMemberItem)
      .click();
    await app.client
      .element(ConversationPage.createClosedGroupMemberItemSelected)
      .isVisible();

    // trigger the creation of the group
    await app.client
      .element(ConversationPage.validateCreationClosedGroupButton)
      .click();

    await app.client.waitForExist(
      ConversationPage.sessionToastGroupCreatedSuccess,
      1000
    );
    await app.client.isExisting(
      ConversationPage.headerTitleGroupName(common.VALID_CLOSED_GROUP_NAME1)
    ).should.eventually.be.true;
    await app.client
      .element(ConversationPage.headerTitleMembers(2))
      .isVisible();

    // validate overlay is closed
    await app.client.isExisting(ConversationPage.leftPaneOverlay).should
      .eventually.be.false;

    // move back to the conversation section
    await app.client
      .element(ConversationPage.conversationButtonSection)
      .click();

    // validate open chat has been added
    await app.client.isExisting(
      ConversationPage.rowOpenGroupConversationName(
        common.VALID_CLOSED_GROUP_NAME1
      )
    ).should.eventually.be.true;

    // next check app2 has been invited and has the group in its conversations
    await app2.client.waitForExist(
      ConversationPage.rowOpenGroupConversationName(
        common.VALID_CLOSED_GROUP_NAME1
      ),
      6000
    );
    // open the closed group conversation on app2
    await app2.client
      .element(ConversationPage.conversationButtonSection)
      .click();
    await common.timeout(500);
    await app2.client
      .element(
        ConversationPage.rowOpenGroupConversationName(
          common.VALID_CLOSED_GROUP_NAME1
        )
      )
      .click();

    // send a message from app and validate it is received on app2
    const textMessage = common.generateSendMessageText();
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .setValue(textMessage);
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .getValue()
      .should.eventually.equal(textMessage);
    // send the message
    await app.client.keys('Enter');

    // validate that the message has been added to the message list view
    await app.client.waitForExist(
      ConversationPage.existingSendMessageText(textMessage),
      2000
    );

    // validate that the message has been added to the message list view
    await app2.client.waitForExist(
      ConversationPage.existingReceivedMessageText(textMessage),
      5000
    );
  });
});
