/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
// tslint:disable: await-promise
// tslint:disable: no-implicit-dependencies
// tslint:disable: no-invalid-this

import { afterEach, beforeEach, describe, it } from 'mocha';
import { Common } from './common';
import { Application } from 'spectron';
import ConversationPage from './page-objects/conversation.page';

async function generateAndSendMessage(app: Application) {
  // send a message from app and validate it is received on app2
  const textMessage = Common.generateSendMessageText();
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

async function makeFriendsPlusMessage(
  app: Application,
  [app2, pubkey]: [Application, string]
) {
  await Common.makeFriends(app, [app2, pubkey]);

  // Send something back so that `app` can see our name
  const text = await generateAndSendMessage(app2);
  await app.client.waitForExist(
    ConversationPage.existingReceivedMessageText(text),
    8000
  );

  // Click away so we can call this function again
  await app.client.element(ConversationPage.conversationButtonSection).click();
}

async function testTwoMembers() {
  const [app, app2] = await Common.startAppsAsFriends();

  const useSenderKeys = true;

  // create group and add new friend
  await Common.addFriendToNewClosedGroup([app, app2], useSenderKeys);

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
  await app.client.waitForExist(
    ConversationPage.existingReceivedMessageText(text2),
    10000
  );
}

async function testThreeMembers() {
  // 1. Make three clients A, B, C

  const app1Props = {
    mnemonic: Common.TEST_MNEMONIC1,
    displayName: Common.TEST_DISPLAY_NAME1,
    stubSnode: true,
  };

  const app2Props = {
    mnemonic: Common.TEST_MNEMONIC2,
    displayName: Common.TEST_DISPLAY_NAME2,
    stubSnode: true,
  };

  const app3Props = {
    mnemonic: Common.TEST_MNEMONIC3,
    displayName: Common.TEST_DISPLAY_NAME3,
    stubSnode: true,
  };

  const [app1, app2, app3] = await Promise.all([
    Common.startAndStub(app1Props),
    Common.startAndStubN(app2Props, 2),
    Common.startAndStubN(app3Props, 3),
  ]);

  // 2. Make A friends with B and C (B and C are not friends)

  await makeFriendsPlusMessage(app1, [app2, Common.TEST_PUBKEY2]);
  await makeFriendsPlusMessage(app1, [app3, Common.TEST_PUBKEY3]);

  const useSenderKeys = true;

  // 3. Add all three to the group

  await Common.addFriendToNewClosedGroup([app1, app2, app3], useSenderKeys);

  // 4. Test that all members can see the message from app1
  const text1 = await generateAndSendMessage(app1);

  await app2.client.waitForExist(
    ConversationPage.existingReceivedMessageText(text1),
    5000
  );

  await app3.client.waitForExist(
    ConversationPage.existingReceivedMessageText(text1),
    5000
  );

  // TODO: test that B and C can send messages to the group

  // const text2 = await generateAndSendMessage(app3);

  // await app2.client.waitForExist(
  //   ConversationPage.existingReceivedMessageText(text2),
  //   5000
  // );
}

describe('senderkeys', function() {
  this.timeout(60000);
  this.slow(20000);
  beforeEach(async () => {
    await Common.killallElectron();
    await Common.stopStubSnodeServer();
  });

  afterEach(async () => {
    await Common.killallElectron();
    await Common.stopStubSnodeServer();
  });

  it('Two member group', testTwoMembers);

  it('Three member group: test session requests', testThreeMembers);
});
