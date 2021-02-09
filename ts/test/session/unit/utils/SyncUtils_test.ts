// tslint:disable: no-implicit-dependencies
import chai from 'chai';
import * as sinon from 'sinon';
import { restoreStubs } from '../../../test-utils/utils';

import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised as any);

describe('SyncUtils', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    restoreStubs();
  });

  describe('syncConfigurationIfNeeded', () => {
    it('sync if last sync undefined', () => {
      // TestUtils.stubData('getItemById').resolves(undefined);
      // sandbox.stub(ConversationController.getInstance(), 'getConversations').returns([]);
      // const getCurrentConfigurationMessageSpy = sandbox.spy(MessageUtils, 'getCurrentConfigurationMessage');
      // await syncConfigurationIfNeeded();
      // expect(getCurrentConfigurationMessageSpy.callCount).equal(1);
    });
  });
});
