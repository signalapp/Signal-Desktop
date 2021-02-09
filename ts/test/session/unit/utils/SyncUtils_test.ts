import chai from 'chai';
import * as sinon from 'sinon';
import { ConversationController } from '../../../../session/conversations';
import * as MessageUtils from '../../../../session/utils/Messages';
import { syncConfigurationIfNeeded } from '../../../../session/utils/syncUtils';
import { TestUtils } from '../../../test-utils';
import { restoreStubs } from '../../../test-utils/utils';
// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('SyncUtils', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    restoreStubs();
  });

  describe('syncConfigurationIfNeeded', () => {
    it('sync if last sync undefined', async () => {
      // TestUtils.stubData('getItemById').resolves(undefined);
      // sandbox.stub(ConversationController.getInstance(), 'getConversations').returns([]);
      // const getCurrentConfigurationMessageSpy = sandbox.spy(MessageUtils, 'getCurrentConfigurationMessage');
      // await syncConfigurationIfNeeded();
      // expect(getCurrentConfigurationMessageSpy.callCount).equal(1);
    });
  });
});
