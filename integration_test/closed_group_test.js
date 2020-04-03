/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const { afterEach, beforeEach, describe, it } = require('mocha');
const common = require('./common');

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

    // create group and add new friend
    await common.addFriendToNewClosedGroup(app, app2);

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
