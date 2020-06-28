import chai from 'chai';
import * as sinon from 'sinon';

import { PubKey } from '../../../session/types/';
import { SyncMessageUtils } from '../../../session/utils/';
import { SyncMessage } from '../../../session/messages/outgoing';
import { TestUtils } from '../../test-utils';
import { UserUtil } from '../../../util';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('Groups Utils', () => {
  const sandbox = sinon.createSandbox();
  

  

  describe('getGroupMembers', () => {
    let ConversationControllerStub: sinon.SinonStub;

    beforeEach(async () => {
      const mockConversation = TestUtils.MockGroupConversation({ type: 'group' });

      ConversationControllerStub = TestUtils.stubWindow('ConversationCollection', {
        get: sandbox.stub().returns(mockConversation),
      });
    });

    it('', async () => {
      //

      // should all be primary keys
    });
  });

  describe('isMediumGroup', () => {
    it('', async () => {
      //
    });
  });
});
