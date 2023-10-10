import chai, { expect } from 'chai';
import Sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import { stubWindowLog } from '../../../test-utils/utils';
import {
  ExpireMessageOnSnodeProps,
  buildExpireRequest,
  verifyExpireMsgsResponseSignature,
  verifyExpireMsgsResponseSignatureProps,
} from '../../../../session/apis/snode_api/expireRequest';
import { UpdateExpiryOnNodeSubRequest } from '../../../../session/apis/snode_api/SnodeRequestTypes';
import { UserUtils } from '../../../../session/utils';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';

chai.use(chaiAsPromised as any);

describe('ExpireRequest', () => {
  stubWindowLog();

  const getLatestTimestampOffset = 200000;
  const ourNumber = '37e1631b002de498caf7c5c1712718bde7f257c6dadeed0c21abf5e939e6c309';
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

  describe('verifyExpireMsgsResponseSignature', () => {
    const props: verifyExpireMsgsResponseSignatureProps = {
      pubkey: '058dc8432a63f9dda4d642bfc3eb5e037838bbd779f73e0a6dfb92b8040a1e7848',
      snodePubkey: 'd9a0fe4581988bdbb3a586f0b254ef60f4e411523be6267b128d1d49bb4585bb',
      messageHashes: ['MVeBDGJz+O1NXcb8f8u9zEjJuwJidwwFYazrgOCqdDg'],
      expiry: 1696913568281,
      signature:
        '8j/1IR3Cnbf0XLL0G+unge6888alheMLAcWehRbQ8zOChqxXwOBHmGu6ZZ99dhvhL8laPg3UAtVcf2iW1CViCQ==',
      updated: ['MVeBDGJz+O1NXcb8f8u9zEjJuwJidwwFYazrgOCqdDg'],
      unchanged: {},
    };

    it('returns true if the signature is valid', async () => {
      const isValid = await verifyExpireMsgsResponseSignature(props);
      expect(isValid, 'should return true').to.be.true;
    });
    it('returns false if the signature is invalid', async () => {
      // use a different pubkey to invalidate the signature
      const isValid = await verifyExpireMsgsResponseSignature({ ...props, pubkey: ourNumber });
      expect(isValid, 'should return false').to.be.false;
    });
    it('returns false if response is missing the expiry timestamp', async () => {
      const isValid = await verifyExpireMsgsResponseSignature({ ...props, expiry: 0 });
      expect(isValid, 'should return false').to.be.false;
    });
    it('returns false if response is missing the messageHashes', async () => {
      const isValid = await verifyExpireMsgsResponseSignature({ ...props, messageHashes: [] });
      expect(isValid, 'should return false').to.be.false;
    });
    it('returns false if response is missing the signature', async () => {
      const isValid = await verifyExpireMsgsResponseSignature({ ...props, signature: '' });
      expect(isValid, 'should return false').to.be.false;
    });
  });
});
