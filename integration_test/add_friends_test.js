/* eslint-disable func-names  */
/* eslint-disable import/no-extraneous-dependencies */
const common = require('./common');
const { afterEach, beforeEach, describe, it } = require('mocha');
const ConversationPage = require('./page-objects/conversation.page');

describe('Add friends', function() {
  let app;
  let app2;
  this.timeout(60000);
  this.slow(15000);

  beforeEach(async () => {
    await common.killallElectron();
    await common.stopStubSnodeServer();

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

    [app, app2] = await Promise.all([
      common.startAndStub(app1Props),
      common.startAndStub2(app2Props),
    ]);
  });

  afterEach(async () => {
    await common.stopApp(app);
    await common.killallElectron();
    await common.stopStubSnodeServer();
  });

  it('can add a friend by sessionID', async () => {
    const textMessage = common.generateSendMessageText();

    await app.client.element(ConversationPage.contactsButtonSection).click();
    await app.client.element(ConversationPage.addContactButton).click();
    await app.client.isExisting(ConversationPage.leftPaneOverlay).should
      .eventually.be.true;

    await app.client
      .element(ConversationPage.sessionIDInput)
      .setValue(common.TEST_PUBKEY2);
    await app.client
      .element(ConversationPage.sessionIDInput)
      .getValue()
      .should.eventually.equal(common.TEST_PUBKEY2);
    await app.client.element(ConversationPage.nextButton).click();
    await app.client.waitForExist(
      ConversationPage.sendFriendRequestTextarea,
      1000
    );

    // send a text message to that user (will be a friend request)
    await app.client
      .element(ConversationPage.sendFriendRequestTextarea)
      .setValue(textMessage);
    await app.client.keys('Enter');
    await app.client.waitForExist(
      ConversationPage.existingFriendRequestText(textMessage),
      1000
    );
    // assure friend request message has been sent
    await common.timeout(3000);
    await app.client.isExisting(ConversationPage.retrySendButton).should
      .eventually.be.false;

    // wait for left notification Friend Request count to go to 1 and click it
    await app2.client.waitForExist(
      ConversationPage.oneNotificationFriendRequestLeft,
      5000
    );
    await app2.client
      .element(ConversationPage.oneNotificationFriendRequestLeft)
      .click();
    // open the dropdown from the top friend request count
    await app2.client.isExisting(
      ConversationPage.oneNotificationFriendRequestTop
    ).should.eventually.be.true;
    await app2.client
      .element(ConversationPage.oneNotificationFriendRequestTop)
      .click();

    // we should have our app1 friend request here
    await app2.client.isExisting(
      ConversationPage.friendRequestFromUser(
        common.TEST_DISPLAY_NAME1,
        common.TEST_PUBKEY1
      )
    ).should.eventually.be.true;
    await app2.client.isExisting(ConversationPage.acceptFriendRequestButton)
      .should.eventually.be.true;

    // accept the friend request and validate that on both side the "accepted FR" message is shown
    await app2.client
      .element(ConversationPage.acceptFriendRequestButton)
      .click();
    await app2.client.waitForExist(
      ConversationPage.acceptedFriendRequestMessage,
      1000
    );
    await app.client.waitForExist(
      ConversationPage.acceptedFriendRequestMessage,
      5000
    );
  });
});
