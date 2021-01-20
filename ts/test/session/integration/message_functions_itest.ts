/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: await-promise
// tslint:disable: no-implicit-dependencies
// tslint:disable: no-invalid-this

import path from 'path';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';

import ConversationPage from './page-objects/conversation.page';

describe('Message Functions', function() {
  this.timeout(60000);
  this.slow(20000);
  let app: Application;
  let app2: Application;

  beforeEach(async () => {
    await Common.killallElectron();
    await Common.stopStubSnodeServer();

    [app, app2] = await Common.startAppsAsFriends();
  });

  afterEach(async () => {
    await Common.stopApp(app);
    await Common.killallElectron();
    await Common.stopStubSnodeServer();
  });

  it('messageFunction: can send attachment', async () => {
    // create group and add new friend
    await Common.addFriendToNewClosedGroup([app, app2]);

    // send attachment from app1 to closed group
    const fileLocation = path.join(__dirname, 'test_attachment');
    const messageText = 'test_attachment';
    await Common.closeToast(app);

    await Common.sendMessage(app, messageText, fileLocation);

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

  it('messageFunction: can delete message', async () => {
    // create group and add new friend
    await Common.addFriendToNewClosedGroup([app, app2]);
    const messageText = 'delete_me';
    await Common.sendMessage(app, messageText);

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
