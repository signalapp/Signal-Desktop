/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: await-promise
// tslint:disable: no-implicit-dependencies
// tslint:disable: no-invalid-this

import { afterEach, beforeEach, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';

import ConversationPage from './page-objects/conversation.page';

describe('Closed groups', function() {
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

  it('closedGroup: can create a closed group with a friend and send/receive a message', async () => {
    // create group and add new friend
    await Common.addFriendToNewClosedGroup([app, app2]);

    // send a message from app and validate it is received on app2
    const textMessage = Common.generateSendMessageText();
    await app.client.element(ConversationPage.sendMessageTextarea).setValue(textMessage);
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .getValue()
      .should.eventually.equal(textMessage);
    // send the message
    await app.client.keys('Enter');

    // validate that the message has been added to the message list view
    await app.client.waitForExist(ConversationPage.existingSendMessageText(textMessage), 2000);

    // validate that the message has been added to the message list view
    await app2.client.waitForExist(ConversationPage.existingReceivedMessageText(textMessage), 5000);
  });
});
