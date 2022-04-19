// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression

import chai from 'chai';
import Sinon, * as sinon from 'sinon';
import { describe } from 'mocha';

import chaiAsPromised from 'chai-as-promised';
import { TestUtils } from '../../../test-utils';
import { UserUtils } from '../../../../session/utils';
import { getConversationController } from '../../../../session/conversations';
import * as Data from '../../../../../ts/data/data';
import * as DataItem from '../../../../../ts/data/channelsItem';
import { getSwarmPollingInstance, SNodeAPI, SnodePool } from '../../../../session/apis/snode_api';
import { SwarmPolling } from '../../../../session/apis/snode_api/swarmPolling';
import { SWARM_POLLING_TIMEOUT } from '../../../../session/constants';
import {
  ConversationCollection,
  ConversationModel,
  ConversationTypeEnum,
} from '../../../../models/conversation';
import { PubKey } from '../../../../session/types';
import { generateFakeSnodes } from '../../../test-utils/utils';
// tslint:disable: chai-vague-errors

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

// tslint:disable-next-line: max-func-body-length
describe('SwarmPolling', () => {
  // Initialize new stubbed cache
  const ourPubkey = TestUtils.generateFakePubKey();
  const ourNumber = ourPubkey.key;

  // tslint:disable-next-line: variable-name
  let TEST_pollOnceForKeySpy: Sinon.SinonSpy<any>;

  let swarmPolling: SwarmPolling;

  let clock: Sinon.SinonFakeTimers;
  beforeEach(async () => {
    // Utils Stubs
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);

    Sinon.stub(Data, 'getAllConversations').resolves(new ConversationCollection());
    Sinon.stub(DataItem, 'getItemById').resolves();
    Sinon.stub(Data, 'saveConversation').resolves();
    Sinon.stub(Data, 'getSwarmNodesForPubkey').resolves();
    Sinon.stub(Data, 'getLastHashBySnode').resolves();

    Sinon.stub(SnodePool, 'getSwarmFor').resolves(generateFakeSnodes(5));
    Sinon.stub(SNodeAPI, 'retrieveNextMessages').resolves([]);
    TestUtils.stubWindow('inboxStore', undefined);
    TestUtils.stubWindow('getGlobalOnlineStatus', () => true);
    TestUtils.stubWindowLog();

    const convoController = getConversationController();
    await convoController.load();
    getConversationController().getOrCreate(ourPubkey.key, ConversationTypeEnum.PRIVATE);

    swarmPolling = getSwarmPollingInstance();
    swarmPolling.TEST_reset();
    TEST_pollOnceForKeySpy = Sinon.spy(swarmPolling, 'TEST_pollOnceForKey');

    clock = sinon.useFakeTimers(Date.now());
  });

  afterEach(() => {
    Sinon.restore();
    getConversationController().reset();
    clock.restore();
  });

  describe('getPollingTimeout', () => {
    it('returns INACTIVE for non existing convo', () => {
      const fakeConvo = TestUtils.generateFakePubKey();

      expect(swarmPolling.TEST_getPollingTimeout(fakeConvo)).to.eq(SWARM_POLLING_TIMEOUT.INACTIVE);
    });

    it('returns ACTIVE for convo with less than two days old activeAt', () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );
      convo.set('active_at', Date.now() - 2 * 23 * 3600 * 1000); // 23 * 2 = 46 hours old
      expect(swarmPolling.TEST_getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
        SWARM_POLLING_TIMEOUT.ACTIVE
      );
    });

    it('returns INACTIVE for convo with undefined activeAt', () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );
      convo.set('active_at', undefined);
      expect(swarmPolling.TEST_getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
        SWARM_POLLING_TIMEOUT.INACTIVE
      );
    });

    it('returns MEDIUM_ACTIVE for convo with activeAt of more than 2 days but less than a week old', () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );
      convo.set('active_at', Date.now() - 1000 * 3600 * 25 * 2); // 25 hours x 2 = 50 hours old
      expect(swarmPolling.TEST_getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
        SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
      );

      convo.set('active_at', Date.now() - 1000 * 3600 * 24 * 7 + 3600); // a week minus an hour old
      expect(swarmPolling.TEST_getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
        SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
      );
    });

    it('returns INACTIVE for convo with  activeAt of more than a week', () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );
      convo.set('active_at', Date.now() - 1000 * 3600 * 24 * 8); // 8 days
      expect(swarmPolling.TEST_getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
        SWARM_POLLING_TIMEOUT.INACTIVE
      );
    });
  });

  describe('pollForAllKeys', () => {
    it('does run for our pubkey even if activeAt is really old ', async () => {
      const convo = getConversationController().getOrCreate(
        ourNumber,
        ConversationTypeEnum.PRIVATE
      );
      convo.set('active_at', Date.now() - 1000 * 3600 * 25);
      await swarmPolling.start(true);

      expect(TEST_pollOnceForKeySpy.callCount).to.eq(1);
      expect(TEST_pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false]);
    });

    it('does run for our pubkey even if activeAt is recent ', async () => {
      const convo = getConversationController().getOrCreate(
        ourNumber,
        ConversationTypeEnum.PRIVATE
      );
      convo.set('active_at', Date.now());
      await swarmPolling.start(true);

      expect(TEST_pollOnceForKeySpy.callCount).to.eq(1);
      expect(TEST_pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false]);
    });

    it('does run for group pubkey on start no matter the recent timestamp  ', async () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );
      convo.set('active_at', Date.now());
      const groupConvoPubkey = PubKey.cast(convo.id as string);
      swarmPolling.addGroupId(groupConvoPubkey);
      await swarmPolling.start(true);

      // our pubkey will be polled for, hence the 2
      expect(TEST_pollOnceForKeySpy.callCount).to.eq(2);
      expect(TEST_pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false]);
      expect(TEST_pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true]);
    });

    it('does run for group pubkey on start no matter the old timestamp ', async () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );

      convo.set('active_at', 1);
      const groupConvoPubkey = PubKey.cast(convo.id as string);
      swarmPolling.addGroupId(groupConvoPubkey);
      await swarmPolling.start(true);

      // our pubkey will be polled for, hence the 2
      expect(TEST_pollOnceForKeySpy.callCount).to.eq(2);
      expect(TEST_pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false]);
      expect(TEST_pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true]);
    });

    it('does run for group pubkey on start but not another time if activeAt is old ', async () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );

      convo.set('active_at', 1); // really old
      const groupConvoPubkey = PubKey.cast(convo.id as string);
      swarmPolling.addGroupId(groupConvoPubkey);

      // this calls the stub 2 times, one for our direct pubkey and one for the group
      await swarmPolling.start(true);

      // this should only call the stub one more time: for our direct pubkey but not for the group pubkey
      await swarmPolling.TEST_pollForAllKeys();

      expect(TEST_pollOnceForKeySpy.callCount).to.eq(3);
      expect(TEST_pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false]);
      expect(TEST_pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true]);
      expect(TEST_pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false]);
    });

    it('does run twice if activeAt less than one hour ', async () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );

      convo.set('active_at', Date.now());
      const groupConvoPubkey = PubKey.cast(convo.id as string);
      swarmPolling.addGroupId(groupConvoPubkey);
      await swarmPolling.start(true);
      clock.tick(6000);
      // no need to do that as the tick will trigger a call in all cases after 5 secs
      // await swarmPolling.TEST_pollForAllKeys();

      expect(TEST_pollOnceForKeySpy.callCount).to.eq(4);
      expect(TEST_pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true]);
      expect(TEST_pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false]);
      expect(TEST_pollOnceForKeySpy.lastCall.args).to.deep.eq([groupConvoPubkey, true]);
    });

    it('does run twice if activeAt is inactive and we tick longer than 2 minutes', async () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );

      TEST_pollOnceForKeySpy.resetHistory();
      convo.set('active_at', Date.now());
      const groupConvoPubkey = PubKey.cast(convo.id as string);
      swarmPolling.addGroupId(groupConvoPubkey);
      // this call the stub two times already, one for our direct pubkey and one for the group
      await swarmPolling.start(true);
      const timeToTick = 3 * 60 * 1000;
      swarmPolling.TEST_forcePolledTimestamp(groupConvoPubkey, Date.now() - timeToTick);
      // more than week old, so inactive group but we have to tick after more than 2 min
      convo.set('active_at', Date.now() - 7 * 25 * 3600 * 1000);
      clock.tick(timeToTick);

      // we should have two more calls here, so 4 total.
      expect(TEST_pollOnceForKeySpy.callCount).to.eq(4);
      expect(TEST_pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false]);
      expect(TEST_pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true]);
      expect(TEST_pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false]);
      expect(TEST_pollOnceForKeySpy.getCalls()[3].args).to.deep.eq([groupConvoPubkey, true]);
    });

    it('does run once only if group is inactive and we tick less than 2 minutes ', async () => {
      const convo = getConversationController().getOrCreate(
        TestUtils.generateFakePubKeyStr(),
        ConversationTypeEnum.GROUP
      );
      TEST_pollOnceForKeySpy.resetHistory();

      convo.set('active_at', Date.now());
      const groupConvoPubkey = PubKey.cast(convo.id as string);
      swarmPolling.addGroupId(groupConvoPubkey);
      await swarmPolling.start(true);

      // more than a week old, we should not tick after just 5 seconds
      convo.set('active_at', Date.now() - 7 * 24 * 3600 * 1000 - 3600 * 1000);

      clock.tick(1 * 60 * 1000);

      // we should have only one more call here, the one for our direct pubkey fetch
      expect(TEST_pollOnceForKeySpy.callCount).to.eq(3);
      expect(TEST_pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true]); // this one comes from the swarmPolling.start
      expect(TEST_pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false]);
    });

    describe('multiple runs', () => {
      let convo: ConversationModel;
      let groupConvoPubkey: PubKey;

      beforeEach(async () => {
        convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );

        convo.set('active_at', Date.now());
        groupConvoPubkey = PubKey.cast(convo.id as string);
        swarmPolling.addGroupId(groupConvoPubkey);
        await swarmPolling.start(true);
      });

      it('does run twice if activeAt is less than 2 days', async () => {
        TEST_pollOnceForKeySpy.resetHistory();
        // less than 2 days old, this is an active group
        convo.set('active_at', Date.now() - 2 * 24 * 3600 * 1000 - 3600 * 1000);

        const timeToTick = 6 * 1000;

        swarmPolling.TEST_forcePolledTimestamp(convo.id, timeToTick);
        // we tick more than 5 sec
        clock.tick(timeToTick);

        await swarmPolling.TEST_pollForAllKeys();
        // we have 4 calls total. 2 for our direct promises run each 5 seconds, and 2 for the group pubkey active (so run every 5 sec too)
        expect(TEST_pollOnceForKeySpy.callCount).to.eq(4);
        // first two calls are our pubkey
        expect(TEST_pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false]);
        expect(TEST_pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true]);

        expect(TEST_pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false]);
        expect(TEST_pollOnceForKeySpy.getCalls()[3].args).to.deep.eq([groupConvoPubkey, true]);
      });

      it('does run twice if activeAt is more than 2 days old and we tick more than one minute ', async () => {
        TEST_pollOnceForKeySpy.resetHistory();
        convo.set('active_at', Date.now() - 2 * 25 * 3600 * 1000); // medium active

        const timeToTick = 65 * 1000;
        swarmPolling.TEST_forcePolledTimestamp(convo.id, timeToTick);

        clock.tick(timeToTick); // should tick twice more (one more our direct pubkey and one for the group)

        await swarmPolling.TEST_pollForAllKeys();
        expect(TEST_pollOnceForKeySpy.callCount).to.eq(4);

        // first two calls are our pubkey
        expect(TEST_pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false]);
        expect(TEST_pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true]);

        expect(TEST_pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false]);
        expect(TEST_pollOnceForKeySpy.getCalls()[3].args).to.deep.eq([groupConvoPubkey, true]);
      });
    });
  });
});
