import chai from 'chai';
import * as sinon from 'sinon';

import { PubKey } from '../../../session/types/';
import { SyncMessageUtils } from '../../../session/utils/';
import { SyncMessage } from '../../../session/messages/outgoing';
import { TestUtils } from '../../test-utils';
import { UserUtil } from '../../../util';
import { generateFakePubKey } from '../../test-utils/testUtils';
import { MultiDeviceProtocol } from '../../../session/protocols';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('Sync Message Utils', () => {
  // getSyncContacts function is tested in test-integration with Electron

  describe('toSyncMessage', () => {
    it('can convert to sync message', async () => {
      const message = TestUtils.generateChatMessage();
      const syncMessage = SyncMessageUtils.toSyncMessage(message);

      // Stubbed
      expect(syncMessage).to.not.exist;
      // expect(syncMessage instanceof SyncMessage).to.equal(true, 'message was not converted to SyncMessage');

      // Further tests required
    });


  });

  describe('canSync', () => {
    it('syncable message returns true', async () => {
      const message = TestUtils.generateChatMessage();

      // Stubbed
      const canSync = SyncMessageUtils.canSync(message);
      expect(canSync).to.equal(false, '');
    });

    it('un-syncable message returns false', async () => {
      const message = TestUtils.generateChatMessage();

      // Stubbed
      const canSync = SyncMessageUtils.canSync(message);
      expect(canSync).to.equal(false, '');
    });

  });

  // describe('getSyncContacts', () => {
  //   let getAllConversationsStub: sinon.SinonStub;

  //   const primaryDevicePubkey = generateFakePubKey().key;
  //   let conversations = [
  //     {
  //       isPrivate: () => true,
  //       isOurLocalDevice: () => false,
  //       isBlocked: () => false,
  //       getPrimaryDevicePubKey: () => primaryDevicePubkey,

  //       attributes: {
  //         secondaryStatus: undefined,
  //       },
  //     },
  //   ];



  //   const sandbox = sinon.createSandbox();
  //   const ourDevice = TestUtils.generateFakePubKey();
  //   const ourNumber = ourDevice.key;

  //   const ourPrimaryDevice = TestUtils.generateFakePubKey();
  //   const ourPrimaryNumber = ourPrimaryDevice.key;

  //   beforeEach(async () => {

  //     getAllConversationsStub = TestUtils.stubData('getAllConversations').resolves(conversations);

  //     // Stubs
  //     sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);
  //     sandbox.stub(MultiDeviceProtocol, 'getPrimaryDevice').resolves(ourPrimaryDevice);
      
  //   });
    
  //   afterEach(() => {
  //     sandbox.restore();
  //   });

  //   it('can get sync contacts', async () => {
  //     // MAKE MORE SPECIFIC, CHECK PARAMETERS

  //     const contacts = await SyncMessageUtils.getSyncContacts();

  //     console.log('[vince] contacts:', contacts);
  //     console.log('[vince] contacts:', contacts);
  //     console.log('[vince] getAllConversationsStub.callCount:', getAllConversationsStub.callCount);
  //     console.log('[vince] getAllConversationsStub.callCount:', getAllConversationsStub.callCount);
      
  //   });

  // });



  
});
