import chai, { expect } from 'chai';
import Sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import { stubWindowLog } from '../../../test-utils/utils';
import {
  ExpireMessageOnSnodeProps,
  buildExpireRequest,
} from '../../../../session/apis/snode_api/expireRequest';
import { UpdateExpiryOnNodeSubRequest } from '../../../../session/apis/snode_api/SnodeRequestTypes';
import { UserUtils } from '../../../../session/utils';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';

chai.use(chaiAsPromised as any);

describe('Snode /expire request', () => {
  stubWindowLog();

  const getLatestTimestampOffset = 200000;
  const ourNumber = '051234567890acbdef';
  const ourUserEd25516Keypair = {
    pubKey: '37e1631b002de498caf7c5c1712718bde7f257c6dadeed0c21abf5e939e6c309',
    privKey:
      'be1d11154ff9b6de77873f0b6b0bcc460000000000000000000000000000000037e1631b002de498caf7c5c1712718bde7f257c6dadeed0c21abf5e939e6c309',
  };

  beforeEach(() => {
    Sinon.stub(GetNetworkTime, 'getLatestTimestampOffset').returns(getLatestTimestampOffset);
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
    Sinon.stub(UserUtils, 'getUserED25519KeyPair').resolves(ourUserEd25516Keypair);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('buildExpireRequest', () => {
    const props: ExpireMessageOnSnodeProps = {
      messageHash: 'messageHash',
      expireTimer: 60,
    };

    it('builds a request with just the messageHash and expireTimer of 1 minute', async () => {
      const request: UpdateExpiryOnNodeSubRequest | null = await buildExpireRequest(props);

      window.log.debug(`WIP: [unit testing] signature ${request?.params.signature} `);

      expect(request, 'should not return null').to.not.be.null;
      expect(request, 'should not return undefined').to.not.be.undefined;
      expect(request, "method should be 'expire'").to.have.property('method', 'expire');
      expect(request?.params.pubkey, 'should have a matching pubkey').to.equal(ourNumber);
      expect(request?.params.messages[0], 'messageHash should be in messages array').to.equal(
        props.messageHash
      );
      expect(
        request?.params.expiry && isValidUnixTimestamp(request?.params.expiry),
        'expiry should be a valid unix timestamp'
      ).to.be.true;
      expect(request?.params.extend, 'extend should be undefined').to.be.undefined;
      expect(request?.params.shorten, 'shorten should be undefined').to.be.undefined;
      expect(request?.params.signature, 'signature should not be empty').to.not.be.empty;
    });
    it('builds a request with extend enabled', async () => {
      const request: UpdateExpiryOnNodeSubRequest | null = await buildExpireRequest({
        ...props,
        extend: true,
      });

      window.log.debug(`WIP: [unit testing] signature ${request?.params.signature} `);

      expect(request, 'should not return null').to.not.be.null;
      expect(request, 'should not return undefined').to.not.be.undefined;
      expect(request, "method should be 'expire'").to.have.property('method', 'expire');
      expect(request?.params.pubkey, 'should have a matching pubkey').to.equal(ourNumber);
      expect(request?.params.messages[0], 'messageHash should be in messages array').to.equal(
        props.messageHash
      );
      expect(
        request?.params.expiry && isValidUnixTimestamp(request?.params.expiry),
        'expiry should be a valid unix timestamp'
      ).to.be.true;
      expect(request?.params.extend, 'extend should be true').to.be.true;
      expect(request?.params.shorten, 'shorten should be undefined').to.be.undefined;
      expect(request?.params.signature, 'signature should not be empty').to.not.be.empty;
    });
    it('builds a request with shorten enabled', async () => {
      const request: UpdateExpiryOnNodeSubRequest | null = await buildExpireRequest({
        ...props,
        shorten: true,
      });

      window.log.debug(`WIP: [unit testing] signature ${request?.params.signature} `);

      expect(request, 'should not return null').to.not.be.null;
      expect(request, 'should not return undefined').to.not.be.undefined;
      expect(request, "method should be 'expire'").to.have.property('method', 'expire');
      expect(request?.params.pubkey, 'should have a matching pubkey').to.equal(ourNumber);
      expect(request?.params.messages[0], 'messageHash should be in messages array').to.equal(
        props.messageHash
      );
      expect(
        request?.params.expiry && isValidUnixTimestamp(request?.params.expiry),
        'expiry should be a valid unix timestamp'
      ).to.be.true;
      expect(request?.params.extend, 'extend should be undefined').to.be.undefined;
      expect(request?.params.shorten, 'shorten should be true').to.be.true;
      expect(request?.params.signature, 'signature should not be empty').to.not.be.empty;
    });
    it('fails to build a request if extend and shorten are both enabled', async () => {
      const request: UpdateExpiryOnNodeSubRequest | null = await buildExpireRequest({
        ...props,
        extend: true,
        shorten: true,
      });

      expect(request, 'should return null').to.be.null;
    });
  });
});
