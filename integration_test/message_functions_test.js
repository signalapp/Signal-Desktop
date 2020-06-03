/* eslint-disable prefer-destructuring */
/* eslint-disable more/no-then */
/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');

const { afterEach, beforeEach, describe, it } = require('mocha');
const common = require('./common');
const ConversationPage = require('./page-objects/conversation.page');

describe('Message Functions', function() {
  let app;
  let app2;
  this.timeout(60000);
  this.slow(15000);

  beforeEach(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();

    [app, app2] = await common.startAppsAsFriends();
    // create group and add new friend
    await common.addFriendToNewClosedGroup([app, app2], false);
  });

  afterEach(async () => {
    await common.stopApp(app);
    await common.killallElectron();
    await common.stopStubSnodeServer();
  });

  it('can send attachment', async () => {
    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.createClosedGroupButton).click();

    // create group and add new friend
    await common.addFriendToNewClosedGroup([app, app2], false);

    // send attachment from app1 to closed group
    const fileLocation = path.join(__dirname, 'test_attachment');
    const messageText = 'test_attachment';

    await common.sendMessage(app, messageText, fileLocation);

    // validate attachment sent
    await app.client.waitForExist(
      ConversationPage.existingSendMessageText(messageText),
      3000
    );
    // validate attachment recieved
    await app2.client.waitForExist(
      ConversationPage.existingReceivedMessageText(messageText),
      5000
    );
  });

  it('can delete message', async () => {
    const messageText = 'delete_me';
    await common.sendMessage(app, messageText);

    await app.client.waitForExist(
      ConversationPage.existingSendMessageText(messageText),
      6000
    );
    await app2.client.waitForExist(
      ConversationPage.existingReceivedMessageText(messageText),
      7000
    );

    // delete message in context menu
    await app.client
      .element(ConversationPage.messageCtxMenu(messageText))
      .click();
    await app.client.element(ConversationPage.deleteMessageCtxButton).click();

    // delete message from modal
    await app.client.waitForExist(
      ConversationPage.deleteMessageModalButton,
      5000
    );
    await app.client.element(ConversationPage.deleteMessageModalButton).click();

    // verify the message is actually deleted
    await app.client.isExisting(
      ConversationPage.existingSendMessageText(messageText)
    ).should.eventually.be.false;
  });
});
