// tslint:disable: no-implicit-dependencies

import { Application } from 'spectron';
import path from 'path';
import url from 'url';
import http from 'http';
import fse from 'fs-extra';
import { exec } from 'child_process';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import CommonPage from './page-objects/common.page';
import RegistrationPage from './page-objects/registration.page';
import ConversationPage from './page-objects/conversation.page';
import SettingsPage from './page-objects/settings.page';

chai.should();
chai.use(chaiAsPromised as any);
chai.config.includeStack = true;

// From https://github.com/chaijs/chai/issues/200
chai.use((_chai, _) => {
  _chai.Assertion.addMethod('withMessage', (msg: string) => {
    _.flag(Common, 'message', msg);
  });
});

const STUB_SNODE_SERVER_PORT = 3000;
const ENABLE_LOG = false;

// tslint:disable-next-line: no-unnecessary-class
export class Common {
  /* **************  USERS  ****************** */
  public static readonly TEST_RECOVERY_PHRASE_1 =
    'faxed mechanic mocked agony unrest loincloth pencil eccentric boyfriend oasis speedy ribbon faxed';
  public static readonly TEST_PUBKEY1 =
    '0552b85a43fb992f6bdb122a5a379505a0b99a16f0628ab8840249e2a60e12a413';
  public static readonly TEST_DISPLAY_NAME1 = 'tester_Alice';

  public static readonly TEST_RECOVERY_PHRASE_2 =
    'guide inbound jerseys bays nouns basin sulking awkward stockpile ostrich ascend pylons ascend';
  public static readonly TEST_PUBKEY2 =
    '054e1ca8681082dbd9aad1cf6fc89a32254e15cba50c75b5a73ac10a0b96bcbd2a';
  public static readonly TEST_DISPLAY_NAME2 = 'tester_Bob';

  public static readonly TEST_RECOVERY_PHRASE_3 =
    'alpine lukewarm oncoming blender kiwi fuel lobster upkeep vogue simplest gasp fully simplest';
  public static readonly TEST_PUBKEY3 =
    '05f8662b6e83da5a31007cc3ded44c601f191e07999acb6db2314a896048d9036c';
  public static readonly TEST_DISPLAY_NAME3 = 'tester_Charlie';

  /* **************  OPEN GROUPS  ****************** */
  public static readonly VALID_GROUP_URL = 'https://chat.getsession.org';
  public static readonly VALID_GROUP_URL2 = 'https://chat-dev.lokinet.org';
  public static readonly VALID_GROUP_NAME = 'Session Public Chat';
  public static readonly VALID_GROUP_NAME2 = 'Loki Dev Chat';

  /* **************  CLOSED GROUPS  ****************** */
  public static readonly VALID_CLOSED_GROUP_NAME1 = 'Closed Group 1';

  public static USER_DATA_ROOT_FOLDER = '';
  private static stubSnode: any;
  private static messages: any;
  private static fileServer: any;

  // tslint:disable: await-promise
  // tslint:disable: no-console

  public static async timeout(ms: number) {
    // tslint:disable-next-line: no-string-based-set-timeout
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static async closeToast(app: Application) {
    await app.client.element(CommonPage.toastCloseButton).click();
  }

  // a wrapper to work around electron/spectron bug
  public static async setValueWrapper(app: Application, selector: any, value: string) {
    // keys, setValue and addValue hang on certain platforms

    if (process.platform === 'darwin') {
      await app.client.execute(
        (slctr, val) => {
          // eslint-disable-next-line no-undef
          const iter = document.evaluate(
            slctr,
            document,
            null,
            XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
            null
          );
          const elem = iter.iterateNext() as any;
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
  }

  public static async startApp(environment = 'test-integration-session') {
    const env = environment.startsWith('test-integration') ? 'test-integration' : environment;
    const instance = environment.replace('test-integration-', '');

    const app1 = new Application({
      path: path.join(__dirname, '..', '..', '..', '..', 'node_modules', '.bin', 'electron'),
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
          // tslint:disable-next-line: insecure-random
          Math.random() * (9999 - 9000) + 9000
        )}`,
      ],
    });
    await app1.start();
    await app1.client.waitUntilWindowLoaded();

    return app1;
  }

  public static async startApp2() {
    const app2 = await Common.startApp('test-integration-session-2');
    return app2;
  }

  public static async stopApp(app1: Application) {
    if (app1 && app1.isRunning()) {
      await app1.stop();
    }
  }

  public static async killallElectron() {
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
  }

  public static async rmFolder(folder: string) {
    await fse.remove(folder);
  }

  public static async startAndAssureCleanedApp2() {
    const app2 = await Common.startAndAssureCleanedApp('test-integration-session-2');
    return app2;
  }

  public static async startAndAssureCleanedApp(env = 'test-integration-session') {
    const userData = path.join(Common.USER_DATA_ROOT_FOLDER, `Session-${env}`);

    await Common.rmFolder(userData);

    const app1 = await Common.startApp(env);
    await app1.client.waitForExist(RegistrationPage.registrationTabSignIn, 4000);

    return app1;
  }

  public static async startAndStub({
    recoveryPhrase,
    displayName,
    env = 'test-integration-session',
  }: {
    recoveryPhrase: string;
    displayName: string;
    env?: string;
  }) {
    const app = await Common.startAndAssureCleanedApp(env);
    Common.startStubSnodeServer();

    if (recoveryPhrase && displayName) {
      await Common.restoreFromRecoveryPhrase(app, recoveryPhrase, displayName);
      // not sure we need Common - rtharp.
      await Common.timeout(2000);
    }

    return app;
  }

  public static async startAndStubN(props: any, n: number) {
    // Make app with stub as number n
    const appN = await Common.startAndStub({
      env: `test-integration-session-${n}`,
      ...props,
    });

    return appN;
  }

  public static async restoreFromRecoveryPhrase(
    app: Application,
    recoveryPhrase: string,
    displayName: string
  ) {
    await app.client.element(RegistrationPage.registrationTabSignIn).click();
    await app.client.element(RegistrationPage.restoreFromSeedMode).click();
    await Common.setValueWrapper(app, RegistrationPage.recoveryPhraseInput, recoveryPhrase);

    await Common.setValueWrapper(app, RegistrationPage.displayNameInput, displayName);

    // await app.client.element(RegistrationPage.continueSessionButton).click();
    await app.client.keys('Enter');

    await app.client.waitForExist(RegistrationPage.conversationListContainer, 4000);
  }

  public static async makeFriends(app1: Application, client2: [Application, string]) {
    const [_, pubkey2] = client2;

    /** add each other as friends */
    const textMessage = Common.generateSendMessageText();
    await app1.client.element(ConversationPage.contactsButtonSection).click();
    await app1.client.element(ConversationPage.addContactButton).click();

    await Common.setValueWrapper(app1, ConversationPage.sessionIDInput, pubkey2);
    await app1.client.element(ConversationPage.nextButton).click();
    await app1.client.waitForExist(ConversationPage.sendMessageTextareaAndMessage, 1000);

    // send a text message to that user (will be a friend request)
    await Common.setValueWrapper(app1, ConversationPage.sendMessageTextareaAndMessage, textMessage);
    await app1.client.keys('Enter');
    await app1.client.waitForExist(ConversationPage.existingSendMessageText(textMessage), 1000);
  }

  public static async startAppsAsFriends() {
    const app1Props = {
      recoveryPhrase: Common.TEST_RECOVERY_PHRASE_1,
      displayName: Common.TEST_DISPLAY_NAME1,
      stubSnode: true,
    };

    const app2Props = {
      recoveryPhrase: Common.TEST_RECOVERY_PHRASE_2,
      displayName: Common.TEST_DISPLAY_NAME2,
      stubSnode: true,
    };

    const [app1, app2] = await Promise.all([
      Common.startAndStub(app1Props),
      Common.startAndStubN(app2Props, 2),
    ]);

    await Common.makeFriends(app1, [app2, Common.TEST_PUBKEY2]);

    return [app1, app2];
  }

  public static async addFriendToNewClosedGroup(members: Array<Application>) {
    const [app, ...others] = members;

    await app.client.element(ConversationPage.conversationButtonSection).click();
    await app.client.element(ConversationPage.createClosedGroupButton).click();

    await Common.setValueWrapper(
      app,
      ConversationPage.closedGroupNameTextarea,
      Common.VALID_CLOSED_GROUP_NAME1
    );

    await app.client
      .element(ConversationPage.closedGroupNameTextarea)
      .getValue()
      .should.eventually.equal(Common.VALID_CLOSED_GROUP_NAME1);

    // Common assumes that app does not have any other friends

    for (let i = 0; i < others.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await app.client.element(ConversationPage.createClosedGroupMemberItem(i)).isVisible().should
        .eventually.be.true;

      // eslint-disable-next-line no-await-in-loop
      await app.client.element(ConversationPage.createClosedGroupMemberItem(i)).click();
    }

    await app.client.element(ConversationPage.createClosedGroupMemberItemSelected).isVisible()
      .should.eventually.be.true;

    // trigger the creation of the group
    await app.client.element(ConversationPage.validateCreationClosedGroupButton).click();

    await app.client.waitForExist(ConversationPage.sessionToastGroupCreatedSuccess, 1000);
    await app.client.isExisting(
      ConversationPage.headerTitleGroupName(Common.VALID_CLOSED_GROUP_NAME1)
    ).should.eventually.be.true;
    await app.client.element(ConversationPage.headerTitleMembers(members.length)).isVisible().should
      .eventually.be.true;

    // validate overlay is closed
    await app.client.isExisting(ConversationPage.leftPaneOverlay).should.eventually.be.equal(false);

    // move back to the conversation section
    await app.client.element(ConversationPage.conversationButtonSection).click();

    // validate open chat has been added
    await app.client.isExisting(
      ConversationPage.rowOpenGroupConversationName(Common.VALID_CLOSED_GROUP_NAME1)
    ).should.eventually.be.true;

    await Promise.all(
      others.map(async otherApp => {
        // next check that other members have been invited and have the group in their conversations
        await otherApp.client.waitForExist(
          ConversationPage.rowOpenGroupConversationName(Common.VALID_CLOSED_GROUP_NAME1),
          6000
        );
        // open the closed group conversation on otherApp
        await otherApp.client.element(ConversationPage.conversationButtonSection).click();
        await Common.timeout(500);
        await otherApp.client
          .element(ConversationPage.rowOpenGroupConversationName(Common.VALID_CLOSED_GROUP_NAME1))
          .click();
      })
    );
  }

  public static async linkApp2ToApp(app1: Application, app2: Application, app1Pubkey: string) {
    // app needs to be logged in as user1 and app2 needs to be logged out
    // start the pairing dialog for the first app
    await app1.client.element(SettingsPage.settingsButtonSection).click();

    await app1.client.isVisible(ConversationPage.noPairedDeviceMessage);
    // we should not find the linkDeviceButtonDisabled button (as DISABLED)
    await app1.client.isExisting(ConversationPage.linkDeviceButtonDisabled).should.eventually.be
      .false;
    await app1.client.element(ConversationPage.linkDeviceButton).click();

    // validate device pairing dialog is shown and has a qrcode
    await app1.client.isVisible(ConversationPage.qrImageDiv);

    // next trigger the link request from the app2 with the app1 pubkey
    await app2.client.element(RegistrationPage.registrationTabSignIn).click();
    await app2.client.element(RegistrationPage.linkDeviceMode).click();

    await Common.setValueWrapper(app2, RegistrationPage.textareaLinkDevicePubkey, app1Pubkey);
    await app2.client.element(RegistrationPage.linkDeviceTriggerButton).click();
    await app1.client.waitForExist(SettingsPage.secretWordsTextInDialog, 7000);
    const secretWordsapp1 = await app1.client
      .element(SettingsPage.secretWordsTextInDialog)
      .getText();
    await app1.client.waitForExist(RegistrationPage.linkWithThisDevice, 10000);

    await app2.client
      .element(RegistrationPage.secretWordsText)
      .getText()
      .should.eventually.be.equal(secretWordsapp1);

    await app1.client.element(ConversationPage.allowPairingButton).click();
    await app1.client.element(ConversationPage.okButton).click();
    // validate device paired in settings list with correct secrets
    await app1.client.waitForExist(ConversationPage.devicePairedDescription(secretWordsapp1), 2000);

    await app1.client.isExisting(ConversationPage.unpairDeviceButton).should.eventually.be.true;
    await app1.client.isExisting(ConversationPage.linkDeviceButtonDisabled).should.eventually.be
      .true;

    // validate app2 (secondary device) is linked successfully
    await app2.client.waitForExist(RegistrationPage.conversationListContainer, 4000);

    // validate primary pubkey of app2 is the same that in app1
    await app2.webContents
      .executeJavaScript("window.storage.get('primaryDevicePubKey')")
      .should.eventually.be.equal(app1Pubkey);
  }

  public static async triggerUnlinkApp2FromApp(app1: Application, app2: Application) {
    // check app2 is loggedin
    await app2.client.isExisting(RegistrationPage.conversationListContainer).should.eventually.be
      .true;

    await app1.client.element(SettingsPage.settingsButtonSection).click();
    await app1.client.isExisting(ConversationPage.linkDeviceButtonDisabled).should.eventually.be
      .true;
    // click the unlink button
    await app1.client.element(ConversationPage.unpairDeviceButton).click();
    await app1.client.element(ConversationPage.validateUnpairDevice).click();

    await app1.client.waitForExist(ConversationPage.noPairedDeviceMessage, 5000);
    await app1.client.element(ConversationPage.linkDeviceButton).isEnabled().should.eventually.be
      .true;

    // let time to app2 to catch the event and restart dropping its data
    await Common.timeout(5000);

    // check that the app restarted
    // (did not find a better way than checking the app no longer being accessible)
    let isApp2Joinable = true;
    try {
      await app2.client.isExisting(RegistrationPage.registrationTabSignIn).should.eventually.be
        .true;
    } catch (err) {
      // if we get an error here, it means Spectron is lost.
      // Common is a good thing because it means app2 restarted
      isApp2Joinable = false;
    }

    if (isApp2Joinable) {
      throw new Error(
        'app2 is still joinable so it did not restart, so it did not unlink correctly'
      );
    }
  }

  public static async sendMessage(app: Application, messageText: string, fileLocation?: string) {
    await Common.setValueWrapper(app, ConversationPage.sendMessageTextarea, messageText);
    await app.client
      .element(ConversationPage.sendMessageTextarea)
      .getValue()
      .should.eventually.equal(messageText);

    // attach a file
    if (fileLocation) {
      await Common.setValueWrapper(app, ConversationPage.attachmentInput, fileLocation);
    }

    // send message
    await app.client.element(ConversationPage.sendMessageTextarea).click();
    await app.client.keys('Enter');
  }

  public static generateSendMessageText(): string {
    return `Test message from integration tests ${Date.now()}`;
  }

  public static startStubSnodeServer() {
    if (!Common.stubSnode) {
      Common.messages = {};
      Common.stubSnode = http.createServer((request: any, response: any) => {
        const { query } = url.parse(request.url, true);
        const { pubkey, data, timestamp } = query;

        if (!pubkey) {
          console.warn('NO PUBKEY');
          response.writeHead(400, { 'Content-Type': 'text/html' });
          response.end();
          return;
        }
        if (Array.isArray(pubkey)) {
          console.error('pubkey cannot be an array');
          response.writeHead(400, { 'Content-Type': 'text/html' });
          response.end();
          return;
        }

        if (Array.isArray(data)) {
          console.error('data cannot be an array');
          response.writeHead(400, { 'Content-Type': 'text/html' });
          response.end();
          return;
        }

        if (request.method === 'POST') {
          if (ENABLE_LOG) {
            console.warn('POST', pubkey.substr(2, 3), data.substr(4, 10), timestamp);
          }

          let ori = Common.messages[pubkey];

          if (!Common.messages[pubkey]) {
            ori = [];
          }

          Common.messages[pubkey] = [...ori, { data, timestamp }];

          response.writeHead(200, { 'Content-Type': 'text/html' });
          response.end();
        } else {
          const retrievedMessages = { messages: Common.messages[pubkey] || [] };

          if (ENABLE_LOG) {
            const messages = retrievedMessages.messages.map((m: any) => m.data.substr(4, 10));
            console.warn('GET', pubkey.substr(2, 3), messages);
          }
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.write(JSON.stringify(retrievedMessages));
          response.end();
        }
      });
      Common.startLocalFileServer();
      Common.stubSnode.listen(STUB_SNODE_SERVER_PORT);
    } else {
      Common.messages = {};
    }
  }

  public static startLocalFileServer() {
    if (!Common.fileServer) {
      // be sure to run `git submodule update --init && cd session-file-server && yarn install; cd -`
      // eslint-disable-next-line global-require
      // tslint:disable-next-line: no-require-imports
      Common.fileServer = require('../../../../session-file-server/app');
    }
  }

  public static async joinOpenGroup(app: Application, openGroupUrl: string, name: string) {
    await app.client.element(ConversationPage.conversationButtonSection).click();
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await Common.setValueWrapper(app, ConversationPage.openGroupInputUrl, openGroupUrl);
    await app.client
      .element(ConversationPage.openGroupInputUrl)
      .getValue()
      .should.eventually.equal(openGroupUrl);
    await app.client.element(ConversationPage.joinOpenGroupButton).click();

    await app.client.waitForExist(ConversationPage.sessionToastJoinOpenGroup, 2 * 1000);

    // account for slow home internet connection delays...
    await app.client.waitForExist(ConversationPage.sessionToastJoinOpenGroupSuccess, 20 * 1000);

    // validate overlay is closed
    await app.client.isExisting(ConversationPage.leftPaneOverlay).should.eventually.be.false;

    // validate open chat has been added
    await app.client.waitForExist(ConversationPage.rowOpenGroupConversationName(name), 20 * 1000);
  }

  public static async stopStubSnodeServer() {
    if (Common.stubSnode) {
      await Common.stubSnode.close();
      Common.stubSnode = null;
    }
  }

  /**
   * Search for a string in logs
   * @param app the render logs to search in
   * @param str the string to search (not regex)
   * Note: getRenderProcessLogs() clears the app logs each calls.
   */
  public static logsContains(renderLogs: Array<{ message: string }>, str: string, count?: number) {
    const foundLines = renderLogs.filter(log => log.message.includes(str));

    // tslint:disable-next-line: no-unused-expression
    chai.expect(foundLines.length > 0, `'${str}' not found in logs but was expected`).to.be.true;

    if (count) {
      chai
        .expect(foundLines.length, `'${str}' found but not the correct number of times`)
        .to.be.equal(count);
    }
  }
}
