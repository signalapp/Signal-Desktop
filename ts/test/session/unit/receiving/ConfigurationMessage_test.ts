import chai from 'chai';
import Sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { SignalService } from '../../../../protobuf';

import { ConfigurationMessage } from '../../../../session/messages/outgoing/controlMessage/ConfigurationMessage';
import { UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';

import * as cache from '../../../../receiver/cache';
import { EnvelopePlus } from '../../../../receiver/types';

import { ConfigMessageHandler } from '../../../../receiver/configMessage';
import { ConfigurationSync } from '../../../../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { ReleasedFeatures } from '../../../../util/releaseFeature';
import { stubData } from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

describe('handleConfigurationMessageLegacy_receiving', () => {
  let createOrUpdateStub: Sinon.SinonStub<any>;
  let getItemByIdStub: Sinon.SinonStub<any>;
  let sender: string;

  let envelope: EnvelopePlus;
  let config: ConfigurationMessage;

  beforeEach(() => {
    TestUtils.stubWindowFeatureFlags();
    Sinon.stub(cache, 'removeFromCache').resolves();
    sender = TestUtils.generateFakePubKey().key;
    config = new ConfigurationMessage({
      activeOpenGroups: [],
      activeClosedGroups: [],
      timestamp: Date.now(),
      identifier: 'identifier',
      displayName: 'displayName',
      contacts: [],
    });
    Sinon.stub(ConfigurationSync, 'queueNewJobIfNeeded').resolves();
    TestUtils.stubWindow('setSettingValue', () => undefined);
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('should not be processed if we do not have a pubkey', async () => {
    TestUtils.stubWindowLog();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').resolves(undefined);

    envelope = TestUtils.generateEnvelopePlus(sender);

    const proto = config.contentProto();
    createOrUpdateStub = stubData('createOrUpdateItem').resolves();
    getItemByIdStub = stubData('getItemById').resolves();
    const checkIsUserConfigFeatureReleasedStub = Sinon.stub(
      ReleasedFeatures,
      'checkIsUserConfigFeatureReleased'
    ).resolves(false);
    await ConfigMessageHandler.handleConfigurationMessageLegacy(
      envelope,
      proto.configurationMessage as SignalService.ConfigurationMessage
    );

    expect(createOrUpdateStub.callCount).to.equal(0);
    expect(getItemByIdStub.callCount).to.equal(0);
    expect(checkIsUserConfigFeatureReleasedStub.callCount).to.be.eq(1); // should only have the one as part of the global legacy check, but none for the smaller handlers
  });

  describe('with ourNumber set', () => {
    const ourNumber = TestUtils.generateFakePubKey().key;

    beforeEach(() => {
      Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').resolves(ourNumber);
    });

    it('should not be processed if the message is not coming from our number', async () => {
      const proto = config.contentProto();
      // sender !== ourNumber
      envelope = TestUtils.generateEnvelopePlus(sender);
      Sinon.stub(ReleasedFeatures, 'checkIsUserConfigFeatureReleased').resolves(false);
      createOrUpdateStub = stubData('createOrUpdateItem').resolves();
      getItemByIdStub = stubData('getItemById').resolves();
      await ConfigMessageHandler.handleConfigurationMessageLegacy(
        envelope,
        proto.configurationMessage as SignalService.ConfigurationMessage
      );
      expect(createOrUpdateStub.callCount).to.equal(0);
      expect(getItemByIdStub.callCount).to.equal(0);
    });
  });
});
