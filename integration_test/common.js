/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-destructuring */

const { Application } = require('spectron');
const path = require('path');
const url = require('url');
const http = require('http');
const fse = require('fs-extra');
const { exec } = require('child_process');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const CommonPage = require('./page-objects/common.page');
const RegistrationPage = require('./page-objects/registration.page');
const ConversationPage = require('./page-objects/conversation.page');
const SettingsPage = require('./page-objects/settings.page');

chai.should();
chai.use(chaiAsPromised);
chai.config.includeStack = true;

const STUB_SNODE_SERVER_PORT = 3000;
const ENABLE_LOG = false;

module.exports = {
  /* **************  USERS  ****************** */
  TEST_MNEMONIC1:
    'faxed mechanic mocked agony unrest loincloth pencil eccentric boyfriend oasis speedy ribbon faxed',
  TEST_PUBKEY1:
    '0552b85a43fb992f6bdb122a5a379505a0b99a16f0628ab8840249e2a60e12a413',
  TEST_DISPLAY_NAME1: 'tester_Alice',

  TEST_MNEMONIC2:
    'guide inbound jerseys bays nouns basin sulking awkward stockpile ostrich ascend pylons ascend',
  TEST_PUBKEY2:
    '054e1ca8681082dbd9aad1cf6fc89a32254e15cba50c75b5a73ac10a0b96bcbd2a',
  TEST_DISPLAY_NAME2: 'tester_Bob',

  TEST_MNEMONIC3:
    'alpine lukewarm oncoming blender kiwi fuel lobster upkeep vogue simplest gasp fully simplest',
  TEST_PUBKEY3:
    '05f8662b6e83da5a31007cc3ded44c601f191e07999acb6db2314a896048d9036c',
  TEST_DISPLAY_NAME3: 'tester_Charlie',

  /* **************  OPEN GROUPS  ****************** */
  VALID_GROUP_URL: 'https://chat.getsession.org',
  VALID_GROUP_URL2: 'https://chat-dev.lokinet.org',
  VALID_GROUP_NAME: 'Session Public Chat',
  VALID_GROUP_NAME2: 'Loki Dev Chat',

  /* **************  CLOSED GROUPS  ****************** */
  VALID_CLOSED_GROUP_NAME1: 'Closed Group 1',

  USER_DATA_ROOT_FOLDER: '',

  async timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async closeToast(app) {
    app.client.element(CommonPage.toastCloseButton).click();
  },

  // a wrapper to work around electron/spectron bug
  async setValueWrapper(app, selector, value) {
    // keys, setValue and addValue hang on certain platforms

    if (process.platform === 'darwin') {
      await app.client.execute(
        (slctr, val) => {
          // eslint-disable-next-line no-undef
          const iter = document.evaluate(
            slctr,
            // eslint-disable-next-line no-undef
            document,
            null,
            // eslint-disable-next-line no-undef
            XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
            null
          );
          const elem = iter.iterateNext();
          if (elem) {
            elem.value = val;
          } else {
            console.error('Cant find', slctr, elem, iter);
          }
        },
        selector,
        value
      );
      // let session js detect the text change
      await app.client.element(selector).click();
    } else {
      // Linux & Windows don't require wrapper
      await app.client.element(selector).setValue(value);
    }
  },

  async startApp(environment = 'test-integration-session') {
    const env = environment.startsWith('test-integration')
      ? 'test-integration'
      : environment;
    const instance = environment.replace('test-integration-', '');

    const app1 = new Application({
      path: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      args: ['.'],
      env: {
        NODE_ENV: env,
        NODE_APP_INSTANCE: instance,
        USE_STUBBED_NETWORK: true,
        ELECTRON_ENABLE_LOGGING: true,
        ELECTRON_ENABLE_STACK_DUMPING: true,
        ELECTRON_DISABLE_SANDBOX: 1,
      },
      requireName: 'electronRequire',
      // chromeDriverLogPath: '../chromedriverlog.txt',
      chromeDriverArgs: [
        `remote-debugging-port=${Math.floor(
          Math.random() * (9999 - 9000) + 9000
        )}`,
      ],
    });

    chaiAsPromised.transferPromiseness = app1.transferPromiseness;

    await app1.start();
    await app1.client.waitUntilWindowLoaded();

    return app1;
  },

  async startApp2() {
    const app2 = await this.startApp('test-integration-session-2');
    return app2;
  },

  async stopApp(app1) {
    if (app1 && app1.isRunning()) {
      await app1.stop();
    }
  },

  async killallElectron() {
    // rtharp - my 2nd client on MacOs needs: pkill -f "node_modules/.bin/electron"
    // node_modules/electron/dist/electron is node_modules/electron/dist/Electron.app on MacOS
    const killStr =
      process.platform === 'win32'
        ? 'taskkill /im electron.exe /t /f'
        : 'pkill -f "node_modules/electron/dist/electron" | pkill -f "node_modules/.bin/electron"';
    return new Promise(resolve => {
      exec(killStr, (_err, stdout, stderr) => {
        resolve({ stdout, stderr });
      });
    });
  },

  async rmFolder(folder) {
    await fse.remove(folder);
  },

  async startAndAssureCleanedApp2() {
    const app2 = await this.startAndAssureCleanedApp(
      'test-integration-session-2'
    );
    return app2;
  },

  async startAndAssureCleanedApp(env = 'test-integration-session') {
    const userData = path.join(this.USER_DATA_ROOT_FOLDER, `Session-${env}`);

    await this.rmFolder(userData);

    const app1 = await this.startApp(env);
    await app1.client.waitForExist(
      RegistrationPage.registrationTabSignIn,
      4000
    );

    return app1;
  },

  async startAndStub({
    mnemonic,
    displayName,
    env = 'test-integration-session',
  }) {
    const app = await this.startAndAssureCleanedApp(env);

    await this.startStubSnodeServer();

    if (mnemonic && displayName) {
      await this.restoreFromMnemonic(app, mnemonic, displayName);
      // not sure we need this - rtharp.
      await this.timeout(2000);
    }

    return app;
  },

  async startAndStubN(props, n) {
    // Make app with stub as number n
    const appN = await this.startAndStub({
      env: `test-integration-session-${n}`,
      ...props,
    });

    return appN;
  },

  async restoreFromMnemonic(app, mnemonic, displayName) {
    await app.client.element(RegistrationPage.registrationTabSignIn).click();
    await app.client.element(RegistrationPage.restoreFromSeedMode).click();
    await this.setValueWrapper(
      app,
      RegistrationPage.recoveryPhraseInput,
      mnemonic
    );

    await this.setValueWrapper(
      app,
      RegistrationPage.displayNameInput,
      displayName
    );

    // await app.client.element(RegistrationPage.continueSessionButton).click();
    await app.client.keys('Enter');

    await app.client.waitForExist(
      RegistrationPage.conversationListContainer,
      4000
    );
  },

  async startAppsAsFriends() {
    const app1Props = {
      mnemonic: this.TEST_MNEMONIC1,
      displayName: this.TEST_DISPLAY_NAME1,
    };

    const app2Props = {
      mnemonic: this.TEST_MNEMONIC2,
      displayName: this.TEST_DISPLAY_NAME2,
    };

    const [app1, app2] = await Promise.all([
      this.startAndStub(app1Props),
      this.startAndStubN(app2Props, 2),
    ]);

    /** add each other as friends */
    const textMessage = this.generateSendMessageText();

    await app1.client.element(ConversationPage.contactsButtonSection).click();
    await app1.client.element(ConversationPage.addContactButton).click();

    await this.setValueWrapper(
      app1,
      ConversationPage.sessionIDInput,
      this.TEST_PUBKEY2
    );
    await app1.client.element(ConversationPage.nextButton).click();
    await app1.client.waitForExist(
      ConversationPage.sendFriendRequestTextarea,
      1000
    );

    // send a text message to that user (will be a friend request)
    await this.setValueWrapper(
      app1,
      ConversationPage.sendFriendRequestTextarea,
      textMessage
    );
    await app1.client.keys('Enter');
    await app1.client.waitForExist(
      ConversationPage.existingFriendRequestText(textMessage),
      1000
    );

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

    // accept the friend request and validate that on both side the "accepted FR" message is shown
    await app2.client
      .element(ConversationPage.acceptFriendRequestButton)
      .click();
    await app2.client.waitForExist(
      ConversationPage.acceptedFriendRequestMessage,
      1000
    );
    await app1.client.waitForExist(
      ConversationPage.acceptedFriendRequestMessage,
      5000
    );

    return [app1, app2];
  },

  async addFriendToNewClosedGroup(app, app2) {
    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.createClosedGroupButton).click();

    await this.setValueWrapper(
      app,
      ConversationPage.closedGroupNameTextarea,
      this.VALID_CLOSED_GROUP_NAME1
    );
    await app.client
      .element(ConversationPage.closedGroupNameTextarea)
      .getValue()
      .should.eventually.equal(this.VALID_CLOSED_GROUP_NAME1);

    await app.client
      .element(ConversationPage.createClosedGroupMemberItem)
      .isVisible().should.eventually.be.true;

    // select the first friend as a member of the groups being created
    await app.client
      .element(ConversationPage.createClosedGroupMemberItem)
      .click();
    await app.client
      .element(ConversationPage.createClosedGroupMemberItemSelected)
      .isVisible().should.eventually.be.true;

    // trigger the creation of the group
    await app.client
      .element(ConversationPage.validateCreationClosedGroupButton)
      .click();

    await app.client.waitForExist(
      ConversationPage.sessionToastGroupCreatedSuccess,
      1000
    );
    await app.client.isExisting(
      ConversationPage.headerTitleGroupName(this.VALID_CLOSED_GROUP_NAME1)
    ).should.eventually.be.true;
    await app.client.element(ConversationPage.headerTitleMembers(2)).isVisible()
      .should.eventually.be.true;

    // validate overlay is closed
    await app.client
      .isExisting(ConversationPage.leftPaneOverlay)
      .should.eventually.be.equal(false);

    // move back to the conversation section
    await app.client
      .element(ConversationPage.conversationButtonSection)
      .click();

    // validate open chat has been added
    await app.client.isExisting(
      ConversationPage.rowOpenGroupConversationName(
        this.VALID_CLOSED_GROUP_NAME1
      )
    ).should.eventually.be.true;

    // next check app2 has been invited and has the group in its conversations
    await app2.client.waitForExist(
      ConversationPage.rowOpenGroupConversationName(
        this.VALID_CLOSED_GROUP_NAME1
      ),
      6000
    );
    // open the closed group conversation on app2
    await app2.client
      .element(ConversationPage.conversationButtonSection)
      .click();
    await this.timeout(500);
    await app2.client
      .element(
        ConversationPage.rowOpenGroupConversationName(
          this.VALID_CLOSED_GROUP_NAME1
        )
      )
      .click();
  },

  async linkApp2ToApp(app1, app2, app1Pubkey) {
    // app needs to be logged in as user1 and app2 needs to be logged out
    // start the pairing dialog for the first app
    await app1.client.element(SettingsPage.settingsButtonSection).click();
    await app1.client
      .element(SettingsPage.settingsRowWithText('Devices'))
      .click();

    await app1.client.isVisible(ConversationPage.noPairedDeviceMessage);
    // we should not find the linkDeviceButtonDisabled button (as DISABLED)
    await app1.client.isExisting(ConversationPage.linkDeviceButtonDisabled)
      .should.eventually.be.false;
    await app1.client.element(ConversationPage.linkDeviceButton).click();

    // validate device pairing dialog is shown and has a qrcode
    await app1.client.isVisible(ConversationPage.devicePairingDialog);
    await app1.client.isVisible(ConversationPage.qrImageDiv);

    // next trigger the link request from the app2 with the app1 pubkey
    await app2.client.element(RegistrationPage.registrationTabSignIn).click();
    await app2.client.element(RegistrationPage.linkDeviceMode).click();

    await this.setValueWrapper(
      app2,
      RegistrationPage.textareaLinkDevicePubkey,
      app1Pubkey
    );
    await app2.client.element(RegistrationPage.linkDeviceTriggerButton).click();
    await app1.client.waitForExist(SettingsPage.secretWordsTextInDialog, 7000);
    const secretWordsapp1 = await app1.client
      .element(SettingsPage.secretWordsTextInDialog)
      .getText();
    await app2.client.waitForExist(RegistrationPage.toastWrapper, 6000);
    await app2.client
      .element(RegistrationPage.secretToastDescription)
      .getText()
      .should.eventually.be.equal(secretWordsapp1);

    await app1.client.element(ConversationPage.allowPairingButton).click();
    await app1.client.element(ConversationPage.okButton).click();
    // validate device paired in settings list with correct secrets
    await app1.client.waitForExist(
      ConversationPage.devicePairedDescription(secretWordsapp1),
      2000
    );

    await app1.client.isExisting(ConversationPage.unpairDeviceButton).should
      .eventually.be.true;
    await app1.client.isExisting(ConversationPage.linkDeviceButtonDisabled)
      .should.eventually.be.true;

    // validate app2 (secondary device) is linked successfully
    await app2.client.waitForExist(
      RegistrationPage.conversationListContainer,
      4000
    );

    // validate primary pubkey of app2 is the same that in app1
    await app2.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(app1Pubkey);
  },

  async triggerUnlinkApp2FromApp(app1, app2) {
    // check app2 is loggedin
    await app2.client.isExisting(RegistrationPage.conversationListContainer)
      .should.eventually.be.true;

    await app1.client.element(SettingsPage.settingsButtonSection).click();
    await app1.client
      .element(SettingsPage.settingsRowWithText('Devices'))
      .click();
    await app1.client.isExisting(ConversationPage.linkDeviceButtonDisabled)
      .should.eventually.be.true;
    // click the unlink button
    await app1.client.element(ConversationPage.unpairDeviceButton).click();
    await app1.client.element(ConversationPage.validateUnpairDevice).click();

    await app1.client.waitForExist(
      ConversationPage.noPairedDeviceMessage,
      2000
    );
    await app1.client.element(ConversationPage.linkDeviceButton).isEnabled()
      .should.eventually.be.true;

    // let time to app2 to catch the event and restart dropping its data
    await this.timeout(5000);

    // check that the app restarted
    // (did not find a better way than checking the app no longer being accessible)
    let isApp2Joinable = true;
    try {
      await app2.client.isExisting(RegistrationPage.registrationTabSignIn)
        .should.eventually.be.true;
    } catch (err) {
      // if we get an error here, it means Spectron is lost.
      // this is a good thing because it means app2 restarted
      isApp2Joinable = false;
    }

    if (isApp2Joinable) {
      throw new Error(
        'app2 is still joinable so it did not restart, so it did not unlink correctly'
      );
    }
  },

  async sendMessage(app, messageText, fileLocation = undefined) {
    await this.setValueWrapper(
      app,
      ConversationPage.sendMessageTextarea,
      messageText
    );
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .getValue()
      .should.eventually.equal(messageText);

    // attach a file
    if (fileLocation) {
      await this.setValueWrapper(
        app,
        ConversationPage.attachmentInput,
        fileLocation
      );
    }

    // send message
    await app.client.element(ConversationPage.sendMessageTextarea).click();
    await app.client.keys('Enter');
  },

  generateSendMessageText: () =>
    `Test message from integration tests ${Date.now()}`,

  async startStubSnodeServer() {
    if (!this.stubSnode) {
      this.messages = {};
      this.stubSnode = http.createServer((request, response) => {
        const { query } = url.parse(request.url, true);
        const { pubkey, data, timestamp } = query;

        if (pubkey) {
          if (request.method === 'POST') {
            if (ENABLE_LOG) {
              console.warn('POST for', pubkey, [data, timestamp]);
            }

            let ori = this.messages[pubkey];
            if (!this.messages[pubkey]) {
              ori = [];
            }

            this.messages[pubkey] = [...ori, { data, timestamp }];

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end();
          } else {
            const messages = this.messages[pubkey] || [];
            const retrievedMessages = { messages };
            if (ENABLE_LOG) {
              console.warn('GET for', pubkey, retrievedMessages);
            }
            response.writeHead(200, { 'Content-Type': 'application/json' });

            response.write(JSON.stringify(retrievedMessages));
            this.messages[pubkey] = [];

            response.end();
          }
        }
        response.end();
      });
      this.startLocalFileServer();
      this.stubSnode.listen(STUB_SNODE_SERVER_PORT);
    } else {
      this.messages = {};
    }
  },

  async startLocalFileServer() {
    if (!this.fileServer) {
      // eslint-disable-next-line global-require
      this.fileServer = require('../loki-file-server/app');
    }
  },

  async joinOpenGroup(app, openGroupUrl, name) {
    await app.client.element(ConversationPage.globeButtonSection).click();
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await this.setValueWrapper(
      app,
      ConversationPage.openGroupInputUrl,
      openGroupUrl
    );
    await app.client
      .element(ConversationPage.openGroupInputUrl)
      .getValue()
      .should.eventually.equal(openGroupUrl);
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    // validate session loader is shown
    await app.client.isExisting(ConversationPage.sessionLoader).should
      .eventually.be.true;
    // account for slow home internet connection delays...
    await app.client.waitForExist(
      ConversationPage.sessionToastJoinOpenGroupSuccess,
      60 * 1000
    );

    // validate overlay is closed
    await app.client.isExisting(ConversationPage.leftPaneOverlay).should
      .eventually.be.false;

    // validate open chat has been added
    await app.client.isExisting(
      ConversationPage.rowOpenGroupConversationName(name)
    ).should.eventually.be.true;
  },

  async stopStubSnodeServer() {
    if (this.stubSnode) {
      this.stubSnode.close();
      this.stubSnode = null;
    }
  },

  /**
   * Search for a string in logs
   * @param {*} app the render logs to search in
   * @param {*} str the string to search (not regex)
   * Note: getRenderProcessLogs() clears the app logs each calls.
   */
  async logsContains(renderLogs, str, count = undefined) {
    const foundLines = renderLogs.filter(log => log.message.includes(str));

    // eslint-disable-next-line no-unused-expressions
    chai.expect(
      foundLines.length > 0,
      `'${str}' not found in logs but was expected`
    ).to.be.true;

    if (count) {
      // eslint-disable-next-line no-unused-expressions
      chai
        .expect(
          foundLines.length,
          `'${str}' found but not the correct number of times`
        )
        .to.be.equal(count);
    }
  },

  // async killStubSnodeServer() {
  //   return new Promise(resolve => {
  //     exec(
  //       `lsof -ti:${STUB_SNODE_SERVER_PORT} |xargs kill -9`,
  //       (err, stdout, stderr) => {
  //         if (err) {
  //           resolve({ stdout, stderr });
  //         } else {
  //           resolve({ stdout, stderr });
  //         }
  //       }
  //     );
  //   });
  // },
};
