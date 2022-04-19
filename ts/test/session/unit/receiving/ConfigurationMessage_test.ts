// tslint:disable: no-implicit-dependencies

import { SignalService } from '../../../../protobuf';
import chai from 'chai';

import { ConfigurationMessage } from '../../../../session/messages/outgoing/controlMessage/ConfigurationMessage';
import { UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';

import Sinon from 'sinon';
import * as cache from '../../../../receiver/cache';
import * as data from '../../../../../ts/data/data';
import { EnvelopePlus } from '../../../../receiver/types';

import chaiAsPromised from 'chai-as-promised';
import { handleConfigurationMessage } from '../../../../receiver/configMessage';
chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

describe('ConfigurationMessage_receiving', () => {
  let createOrUpdateStub: Sinon.SinonStub<any>;
  let getItemByIdStub: Sinon.SinonStub<any>;
  let sender: string;

  let envelope: EnvelopePlus;
  let config: ConfigurationMessage;

  beforeEach(() => {
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
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('should not be processed if we do not have a pubkey', async () => {
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').resolves(undefined);
    envelope = TestUtils.generateEnvelopePlus(sender);

    const proto = config.contentProto();
    createOrUpdateStub = Sinon.stub(data, 'createOrUpdateItem').resolves();
    getItemByIdStub = Sinon.stub(data, 'getItemById').resolves();
    await handleConfigurationMessage(
      envelope,
      proto.configurationMessage as SignalService.ConfigurationMessage
    );
    expect(createOrUpdateStub.callCount).to.equal(0);
    expect(getItemByIdStub.callCount).to.equal(0);
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

      createOrUpdateStub = Sinon.stub(data, 'createOrUpdateItem').resolves();
      getItemByIdStub = Sinon.stub(data, 'getItemById').resolves();
      await handleConfigurationMessage(
        envelope,
        proto.configurationMessage as SignalService.ConfigurationMessage
      );
      expect(createOrUpdateStub.callCount).to.equal(0);
      expect(getItemByIdStub.callCount).to.equal(0);
    });

    // it('should be processed if the message is coming from our number', async () => {
    //     const proto = config.contentProto();
    //     envelope = TestUtils.generateEnvelopePlus(ourNumber);

    //     createOrUpdateStub = sandbox.stub(data, 'createOrUpdateItem').resolves();
    //     getItemByIdStub = sandbox.stub(data, 'getItemById').resolves();
    //     await handleConfigurationMessage(envelope, proto.configurationMessage as SignalService.ConfigurationMessage);
    //     expect(getItemByIdStub.callCount).to.equal(1);
    // });
  });
});
