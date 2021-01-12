import chai from 'chai';
import * as sinon from 'sinon';

import { SyncMessageUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';
import { UserUtil } from '../../../../util';
import { MultiDeviceProtocol } from '../../../../session/protocols';
import { SyncMessage } from '../../../../session/messages/outgoing';
import { ConversationController } from '../../../../session/conversations';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('Sync Message Utils', () => {
  describe('getSyncContacts', () => {
    let getAllConversationsStub: sinon.SinonStub;
    let getOrCreateAndWaitStub: sinon.SinonStub;
    let getOrCreateAndWaitItem: any;

    // Fill half with secondaries, half with primaries
    const numConversations = 20;
    const primaryConversations = new Array(numConversations / 2).fill({}).map(
      () =>
        new TestUtils.MockConversation({
          type: TestUtils.MockConversationType.Primary,
        })
    );
    const secondaryConversations = new Array(numConversations / 2).fill({}).map(
      () =>
        new TestUtils.MockConversation({
          type: TestUtils.MockConversationType.Secondary,
        })
    );
    const conversations = [...primaryConversations, ...secondaryConversations];

    const sandbox = sinon.createSandbox();
    const ourDevice = TestUtils.generateFakePubKey();
    const ourNumber = ourDevice.key;

    const ourPrimaryDevice = TestUtils.generateFakePubKey();

    beforeEach(async () => {
      // Util Stubs
      TestUtils.stubWindow('Whisper', {
        ConversationCollection: sandbox.stub(),
      });

      getAllConversationsStub = TestUtils.stubData(
        'getAllConversations'
      ).resolves(conversations);

      // Scale result in sync with secondaryConversations on callCount
      getOrCreateAndWaitStub = sandbox.stub().callsFake(() => {
        const item =
          secondaryConversations[getOrCreateAndWaitStub.callCount - 1];

        // Make the item a primary device to match the call in SyncMessage under secondaryContactsPromise
        getOrCreateAndWaitItem = {
          ...item,
          getPrimaryDevicePubKey: () => item.id,
          attributes: {
            secondaryStatus: false,
          },
        };

        return getOrCreateAndWaitItem;
      });

      // FIXME audric
      throw new Error();
      // sandbox
      //   .stub(ConversationController.getInstance(), 'getOrCreateAndWait')
      //   .resolves(getOrCreateAndWaitStub);

      // Stubs
      sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);
      sandbox
        .stub(MultiDeviceProtocol, 'getPrimaryDevice')
        .resolves(ourPrimaryDevice);
    });

    afterEach(() => {
      sandbox.restore();
      TestUtils.restoreStubs();
    });

    it('can get sync contacts with only primary contacts', async () => {
      getAllConversationsStub.resolves(primaryConversations);

      const contacts = await SyncMessageUtils.getSyncContacts();
      expect(getAllConversationsStub.callCount).to.equal(1);

      // Each contact should be a primary device
      expect(contacts).to.have.length(numConversations / 2);
      expect(contacts?.find(c => c.attributes.secondaryStatus)).to.not.exist;
    });
  });
});
