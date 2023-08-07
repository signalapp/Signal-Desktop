import chai from 'chai';
import { describe } from 'mocha';
import Sinon, * as sinon from 'sinon';

import chaiAsPromised from 'chai-as-promised';
import { ConversationModel } from '../../../../models/conversation';
import { ConversationTypeEnum } from '../../../../models/conversationAttributes';
import { getSwarmPollingInstance, SnodePool } from '../../../../session/apis/snode_api';
import { resetHardForkCachedValues } from '../../../../session/apis/snode_api/hfHandling';
import { SnodeAPIRetrieve } from '../../../../session/apis/snode_api/retrieveRequest';
import { SwarmPolling } from '../../../../session/apis/snode_api/swarmPolling';
import { SWARM_POLLING_TIMEOUT } from '../../../../session/constants';
import { getConversationController } from '../../../../session/conversations';
import { PubKey } from '../../../../session/types';
import { UserUtils } from '../../../../session/utils';
import { ConfigurationSync } from '../../../../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { sleepFor } from '../../../../session/utils/Promise';
import { UserGroupsWrapperActions } from '../../../../webworker/workers/browser/libsession_worker_interface';
import { TestUtils } from '../../../test-utils';
import { generateFakeSnodes, stubData } from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

describe('SwarmPolling', () => {
  // Initialize new stubbed cache
  const ourPubkey = TestUtils.generateFakePubKey();
  const ourNumber = ourPubkey.key;

  let pollOnceForKeySpy: Sinon.SinonSpy<any>;

  let swarmPolling: SwarmPolling;
  let getItemByIdStub: Sinon.SinonStub;

  let clock: Sinon.SinonFakeTimers;
  beforeEach(async () => {
    getConversationController().reset();
    TestUtils.stubWindowFeatureFlags();
    Sinon.stub(ConfigurationSync, 'queueNewJobIfNeeded').resolves();

    // Utils Stubs
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);

    stubData('getAllConversations').resolves([]);
    getItemByIdStub = TestUtils.stubData('getItemById');
    stubData('saveConversation').resolves();
    stubData('getSwarmNodesForPubkey').resolves();
    stubData('getLastHashBySnode').resolves();

    Sinon.stub(SnodePool, 'getSwarmFor').resolves(generateFakeSnodes(5));
    Sinon.stub(SnodeAPIRetrieve, 'retrieveNextMessages').resolves([]);
    TestUtils.stubWindow('inboxStore', undefined);
    TestUtils.stubWindow('getGlobalOnlineStatus', () => true);
    TestUtils.stubWindowLog();

    const convoController = getConversationController();
    await convoController.load();
    getConversationController().getOrCreate(ourPubkey.key, ConversationTypeEnum.PRIVATE);

    swarmPolling = getSwarmPollingInstance();
    swarmPolling.resetSwarmPolling();
    pollOnceForKeySpy = Sinon.spy(swarmPolling, 'pollOnceForKey');

    clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });
  });

  afterEach(() => {
    Sinon.restore();
    getConversationController().reset();
    clock.restore();
    resetHardForkCachedValues();
  });

  describe('getPollingTimeout', () => {
    beforeEach(() => {
      TestUtils.stubLibSessionWorker(undefined);
    });
    it('returns INACTIVE for non existing convo', () => {
      const fakeConvo = TestUtils.generateFakePubKey();

      expect(swarmPolling.getPollingTimeout(fakeConvo)).to.eq(SWARM_POLLING_TIMEOUT.INACTIVE);
    });

    describe('legacy groups', () => {
      it('returns ACTIVE for convo with less than two days old activeAt', () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        convo.set('active_at', Date.now() - 2 * 23 * 3600 * 1000); // 23 * 2 = 46 hours old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.ACTIVE
        );
      });

      it('returns INACTIVE for convo with undefined activeAt', () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        convo.set('active_at', undefined);
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.INACTIVE
        );
      });

      it('returns MEDIUM_ACTIVE for convo with activeAt of more than 2 days but less than a week old', () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        convo.set('active_at', Date.now() - 1000 * 3600 * 25 * 2); // 25 hours x 2 = 50 hours old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
        );

        convo.set('active_at', Date.now() - 1000 * 3600 * 24 * 7 + 3600); // a week minus an hour old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
        );
      });

      it('returns INACTIVE for convo with  activeAt of more than a week', () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        convo.set('active_at', Date.now() - 1000 * 3600 * 24 * 8); // 8 days
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.INACTIVE
        );
      });
    });

    describe('groupv3', () => {
      it('returns ACTIVE for convo with less than two days old activeAt', () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakeClosedGroupV3PkStr(),
          ConversationTypeEnum.GROUPV3
        );
        convo.set('active_at', Date.now() - 2 * 23 * 3600 * 1000); // 23 * 2 = 46 hours old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.ACTIVE
        );
      });

      it('returns INACTIVE for convo with undefined activeAt', () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakeClosedGroupV3PkStr(),
          ConversationTypeEnum.GROUPV3
        );
        convo.set('active_at', undefined);
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.INACTIVE
        );
      });

      it('returns MEDIUM_ACTIVE for convo with activeAt of more than 2 days but less than a week old', () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakeClosedGroupV3PkStr(),
          ConversationTypeEnum.GROUPV3
        );
        convo.set('active_at', Date.now() - 1000 * 3600 * 25 * 2); // 25 hours x 2 = 50 hours old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
        );

        convo.set('active_at', Date.now() - 1000 * 3600 * 24 * 7 + 3600); // a week minus an hour old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
        );
      });

      it('returns INACTIVE for convo with  activeAt of more than a week', () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakeClosedGroupV3PkStr(),
          ConversationTypeEnum.GROUPV3
        );
        convo.set('active_at', Date.now() - 1000 * 3600 * 24 * 8); // 8 days
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id as string))).to.eq(
          SWARM_POLLING_TIMEOUT.INACTIVE
        );
      });
    });
  });

  describe('pollForAllKeys', () => {
    beforeEach(() => {
      stubData('createOrUpdateItem').resolves();
    });
    afterEach(() => {
      Sinon.restore();
    });
    it('does run for our pubkey even if activeAt is really old ', async () => {
      const convo = getConversationController().getOrCreate(
        ourNumber,
        ConversationTypeEnum.PRIVATE
      );
      convo.set('active_at', Date.now() - 1000 * 3600 * 25);
      await swarmPolling.start(true);

      expect(pollOnceForKeySpy.callCount).to.eq(1);
      expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
    });

    it('does run for our pubkey even if activeAt is recent ', async () => {
      const convo = getConversationController().getOrCreate(
        ourNumber,
        ConversationTypeEnum.PRIVATE
      );
      convo.set('active_at', Date.now());
      await swarmPolling.start(true);

      expect(pollOnceForKeySpy.callCount).to.eq(1);
      expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
    });

    describe('legacy group', () => {
      it('does run for group pubkey on start no matter the recent timestamp', async () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        TestUtils.stubLibSessionWorker(undefined);
        convo.set('active_at', Date.now());
        const groupConvoPubkey = PubKey.cast(convo.id as string);
        swarmPolling.addGroupId(groupConvoPubkey);
        await swarmPolling.start(true);

        // our pubkey will be polled for, hence the 2
        expect(pollOnceForKeySpy.callCount).to.eq(2);
        expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
        expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]);
      });

      it('does only poll from -10 for closed groups if HF >= 19.1  ', async () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        TestUtils.stubLibSessionWorker(undefined);
        getItemByIdStub.restore();
        getItemByIdStub = TestUtils.stubData('getItemById');
        getItemByIdStub
          .withArgs('hasSeenHardfork190')
          .resolves({ id: 'hasSeenHardfork190', value: true })
          .withArgs('hasSeenHardfork191')
          .resolves({ id: 'hasSeenHardfork191', value: true });

        convo.set('active_at', 1);
        const groupConvoPubkey = PubKey.cast(convo.id as string);
        swarmPolling.addGroupId(groupConvoPubkey);

        await swarmPolling.start(true);

        // our pubkey will be polled for, hence the 2
        expect(pollOnceForKeySpy.callCount).to.eq(2);
        expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
        expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]);
        getItemByIdStub.restore();
        getItemByIdStub = TestUtils.stubData('getItemById');

        getItemByIdStub.resolves();
      });

      it('does run for group pubkey on start but not another time if activeAt is old ', async () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        TestUtils.stubLibSessionWorker(undefined);

        convo.set('active_at', 1); // really old, but active
        const groupConvoPubkey = PubKey.cast(convo.id as string);
        swarmPolling.addGroupId(groupConvoPubkey);

        // this calls the stub 2 times, one for our direct pubkey and one for the group
        await swarmPolling.start(true);

        // this should only call the stub one more time: for our direct pubkey but not for the group pubkey
        await swarmPolling.pollForAllKeys();

        expect(pollOnceForKeySpy.callCount).to.eq(3);
        expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
        expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]);
        expect(pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
      });

      it('does run twice if activeAt less than one hour ', async () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );

        // fake that the group is part of the wrapper otherwise we stop tracking it after the first polling event
        Sinon.stub(UserGroupsWrapperActions, 'getLegacyGroup').resolves({} as any);

        convo.set('active_at', Date.now());
        const groupConvoPubkey = PubKey.cast(convo.id as string);
        swarmPolling.addGroupId(groupConvoPubkey);
        await swarmPolling.start(true);
        expect(pollOnceForKeySpy.callCount).to.eq(2);
        expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
        expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]);
        pollOnceForKeySpy.resetHistory();
        clock.tick(9000);

        // no need to do that as the tick will trigger a call in all cases after 5 secs await swarmPolling.pollForAllKeys();
        /** this is not easy to explain, but
         * - during the swarmPolling.start, we get two calls to pollOnceForKeySpy (one for our id and one for group id)
         * - the clock ticks 9sec, and another call of pollOnceForKeySpy get started, but as we do not await them, this test fails.
         * the only fix is to restore the clock and force the a small sleep to let the thing run in bg
         */

        await sleepFor(10);

        expect(pollOnceForKeySpy.callCount).to.eq(2);
        expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
        expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]);
      });

      it('does run twice if activeAt is inactive and we tick longer than 2 minutes', async () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        // fake that the group is part of the wrapper otherwise we stop tracking it after the first polling event
        Sinon.stub(UserGroupsWrapperActions, 'getLegacyGroup').resolves({} as any);
        pollOnceForKeySpy.resetHistory();
        convo.set('active_at', Date.now());
        const groupConvoPubkey = PubKey.cast(convo.id as string);
        swarmPolling.addGroupId(groupConvoPubkey);
        // this call the stub two times already, one for our direct pubkey and one for the group
        await swarmPolling.start(true);
        const timeToTick = 3 * 60 * 1000;
        swarmPolling.forcePolledTimestamp(groupConvoPubkey, Date.now() - timeToTick);
        // more than week old, so inactive group but we have to tick after more than 2 min
        convo.set('active_at', Date.now() - 7 * 25 * 3600 * 1000);
        clock.tick(timeToTick);
        /** this is not easy to explain, but
         * - during the swarmPolling.start, we get two calls to pollOnceForKeySpy (one for our id and one for group od)
         * - the clock ticks 9sec, and another call of pollOnceForKeySpy get started, but as we do not await them, this test fails.
         * the only fix is to restore the clock and force the a small sleep to let the thing run in bg
         */
        await sleepFor(10);
        // we should have two more calls here, so 4 total.
        expect(pollOnceForKeySpy.callCount).to.eq(4);
        expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
        expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]);
        expect(pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
        expect(pollOnceForKeySpy.getCalls()[3].args).to.deep.eq([groupConvoPubkey, true, [-10]]);
      });

      it('does run once only if group is inactive and we tick less than 2 minutes ', async () => {
        const convo = getConversationController().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        pollOnceForKeySpy.resetHistory();
        TestUtils.stubLibSessionWorker(undefined);
        convo.set('active_at', Date.now());
        const groupConvoPubkey = PubKey.cast(convo.id as string);
        swarmPolling.addGroupId(groupConvoPubkey);
        await swarmPolling.start(true);

        // more than a week old, we should not tick after just 5 seconds
        convo.set('active_at', Date.now() - 7 * 24 * 3600 * 1000 - 3600 * 1000);

        clock.tick(1 * 60 * 1000);
        await sleepFor(10);

        // we should have only one more call here, the one for our direct pubkey fetch
        expect(pollOnceForKeySpy.callCount).to.eq(3);
        expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]); // this one comes from the swarmPolling.start
        expect(pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
      });

      describe('multiple runs', () => {
        let convo: ConversationModel;
        let groupConvoPubkey: PubKey;

        beforeEach(async () => {
          convo = getConversationController().getOrCreate(
            TestUtils.generateFakePubKeyStr(),
            ConversationTypeEnum.GROUP
          );
          TestUtils.stubLibSessionWorker({});

          convo.set('active_at', Date.now());
          groupConvoPubkey = PubKey.cast(convo.id as string);
          swarmPolling.addGroupId(groupConvoPubkey);
          await swarmPolling.start(true);
        });

        afterEach(() => {
          Sinon.restore();
          getConversationController().reset();
          clock.restore();
          resetHardForkCachedValues();
        });

        it('does run twice if activeAt is less than 2 days', async () => {
          pollOnceForKeySpy.resetHistory();
          // less than 2 days old, this is an active group
          convo.set('active_at', Date.now() - 2 * 24 * 3600 * 1000 - 3600 * 1000);

          const timeToTick = 6 * 1000;

          swarmPolling.forcePolledTimestamp(convo.id, timeToTick);
          // we tick more than 5 sec
          clock.tick(timeToTick);

          await swarmPolling.pollForAllKeys();
          // we have 4 calls total. 2 for our direct promises run each 5 seconds, and 2 for the group pubkey active (so run every 5 sec too)
          expect(pollOnceForKeySpy.callCount).to.eq(4);
          // first two calls are our pubkey
          expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
          expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]);

          expect(pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
          expect(pollOnceForKeySpy.getCalls()[3].args).to.deep.eq([groupConvoPubkey, true, [-10]]);
        });

        it('does run twice if activeAt is more than 2 days old and we tick more than one minute', async () => {
          pollOnceForKeySpy.resetHistory();
          TestUtils.stubWindowLog();
          convo.set('active_at', Date.now() - 2 * 25 * 3600 * 1000); // medium active
          // fake that the group is part of the wrapper otherwise we stop tracking it after the first polling event

          const timeToTick = 65 * 1000; // more than one minute
          swarmPolling.forcePolledTimestamp(convo.id, timeToTick);
          clock.tick(timeToTick); // should tick twice more (one more our direct pubkey and one for the group)

          // fake that the group is part of the wrapper otherwise we stop tracking it after the first polling event

          await swarmPolling.pollForAllKeys();

          expect(pollOnceForKeySpy.callCount).to.eq(4);

          // first two calls are our pubkey
          expect(pollOnceForKeySpy.firstCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
          expect(pollOnceForKeySpy.secondCall.args).to.deep.eq([groupConvoPubkey, true, [-10]]);
          expect(pollOnceForKeySpy.thirdCall.args).to.deep.eq([ourPubkey, false, [0, 2, 3, 5, 4]]);
          expect(pollOnceForKeySpy.getCalls()[3].args).to.deep.eq([groupConvoPubkey, true, [-10]]);
        });
      });
    });
  });
});
