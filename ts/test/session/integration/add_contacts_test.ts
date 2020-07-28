/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: await-promise
// tslint:disable: no-implicit-dependencies

import { afterEach, beforeEach, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';

import ConversationPage from './page-objects/conversation.page';

describe('Add contact', function() {
  let app: Application;
  let app2: Application;
  this.timeout(60000);
  this.slow(15000);

  beforeEach(async () => {
    await Common.killallElectron();
    await Common.stopStubSnodeServer();

    const app1Props = {
      mnemonic: Common.TEST_MNEMONIC1,
      displayName: Common.TEST_DISPLAY_NAME1,
    };

    const app2Props = {
      mnemonic: Common.TEST_MNEMONIC2,
      displayName: Common.TEST_DISPLAY_NAME2,
    };

    [app, app2] = await Promise.all([
      Common.startAndStub(app1Props),
      Common.startAndStubN(app2Props, 2),
    ]);
  });

  afterEach(async () => {
    await Common.stopApp(app);
    await Common.killallElectron();
    await Common.stopStubSnodeServer();
  });

  it('addContacts: can add a contact by sessionID', async () => {
    const textMessage = Common.generateSendMessageText();

    await app.client.element(ConversationPage.contactsButtonSection).click();
    await app.client.element(ConversationPage.addContactButton).click();
    await app.client.isExisting(ConversationPage.leftPaneOverlay).should
      .eventually.be.true;

    await Common.setValueWrapper(
      app,
      ConversationPage.sessionIDInput,
      Common.TEST_PUBKEY2
    );
    await app.client
      .element(ConversationPage.sessionIDInput)
      .getValue()
      .should.eventually.equal(Common.TEST_PUBKEY2);

    await app.client.element(ConversationPage.nextButton).click();
    await app.client.waitForExist(ConversationPage.sendMessageTextarea, 1000);

    // send a text message to that user
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .setValue(textMessage);
    await app.client.keys('Enter');
    await app.client.waitForExist(
      ConversationPage.existingSendMessageText(textMessage),
      1000
    );

    // assure session request message has been sent
    await Common.timeout(3000);
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
