// tslint:disable: no-implicit-dependencies
import chai from 'chai';

import chaiAsPromised from 'chai-as-promised';
import Sinon from 'sinon';
chai.use(chaiAsPromised as any);

describe('SyncUtils', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('syncConfigurationIfNeeded', () => {
    it('sync if last sync undefined', () => {
      // TestUtils.stubData('getItemById').resolves(undefined);
      // sandbox.stub(ConversationController, 'getConversations').returns([]);
      // const getCurrentConfigurationMessageSpy = sandbox.spy(MessageUtils, 'getCurrentConfigurationMessage');
      // await syncConfigurationIfNeeded();
      // expect(getCurrentConfigurationMessageSpy.callCount).equal(1);
    });
  });
});
