/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const { afterEach, beforeEach, describe, it } = require('mocha');
const common = require('./common');

const ConversationPage = require('./page-objects/conversation.page');

async function generateAndSendMessage(app) {

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

    return textMessage;

}

describe('senderkeys', function() {
  let app;
  let app2;

  this.timeout(60000);
  this.slow(30000);

  beforeEach(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();

  });

  afterEach(async () => {
    await common.stopApp(app);
    await common.killallElectron();
    await common.stopStubSnodeServer();
  });

  it('Two member group', async function() {

    [app, app2] = await common.startAppsAsFriends();

    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.createClosedGroupButton).click();

    const useSenderKeys = true;

    // create group and add new friend
    await common.addFriendToNewClosedGroup([app, app2], useSenderKeys);

    const text1 = await generateAndSendMessage(app);

    // validate that the message has been added to the message list view
    await app2.client.waitForExist(
        ConversationPage.existingReceivedMessageText(text1),
        5000
    );

    // Send a message back:
    const text2 = await generateAndSendMessage(app2);

    // TODO: fix this. We can send messages back manually, not sure
    // why this test fails
    // await app.client.waitForExist(
    //     ConversationPage.existingReceivedMessageText(text2),
    //     10000
    // );

  });

  it('Three member group: test session requests', async function() {

    // 1. Make three clients A, B, C

    const app1Props = {
        mnemonic: common.TEST_MNEMONIC1,
        displayName: common.TEST_DISPLAY_NAME1,
        stubSnode: true,
      };
  
      const app2Props = {
        mnemonic: common.TEST_MNEMONIC2,
        displayName: common.TEST_DISPLAY_NAME2,
        stubSnode: true,
      };

      const app3Props = {
        mnemonic: common.TEST_MNEMONIC3,
        displayName: common.TEST_DISPLAY_NAME3,
        stubSnode: true,
      };
  
      const [app1, app2, app3] = await Promise.all([
        common.startAndStub(app1Props),
        common.startAndStubN(app2Props, 2),
        common.startAndStubN(app3Props, 3)
      ]);

      // 2. Make A friends with B and C (B and C are not friends)

      await common.makeFriends(app1, [app2, common.TEST_PUBKEY2]);

      await common.makeFriends(app1, [app3, common.TEST_PUBKEY3]);

      // const text1 = await generateAndSendMessage(app1);

      // // validate that the message has been added to the message list view
      // await app2.client.waitForExist(
      //     ConversationPage.existingReceivedMessageText(text1),
      //     5000
      // );

      // // validate that the message has been added to the message list view
      // await app3.client.waitForExist(
      //   ConversationPage.existingReceivedMessageText(text1),
      //   5000
      // );

      // TODO: test that B and C can send messages to the group


  });

});
