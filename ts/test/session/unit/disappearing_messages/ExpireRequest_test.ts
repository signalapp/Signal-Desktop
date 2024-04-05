import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Sinon from 'sinon';
import { UpdateExpiryOnNodeSubRequest } from '../../../../session/apis/snode_api/SnodeRequestTypes';
import {
  ExpireMessageWithExpiryOnSnodeProps,
  ExpireRequestResponseResults,
  buildExpireRequestSingleExpiry,
  processExpireRequestResponse,
  verifyExpireMsgsResponseSignature,
  verifyExpireMsgsResponseSignatureProps,
} from '../../../../session/apis/snode_api/expireRequest';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';
import { UserUtils } from '../../../../session/utils';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';
import { generateFakeSnode } from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);

describe('ExpireRequest', () => {
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
    const props: ExpireMessageWithExpiryOnSnodeProps = {
      messageHashes: ['messageHash'],
      expiryMs: 12340000 + 60 * 1000,
      shortenOrExtend: '',
    };

    it('builds a request with just the messageHash and expireTimer of 1 minute', async () => {
      const request: UpdateExpiryOnNodeSubRequest | null =
        await buildExpireRequestSingleExpiry(props);

      expect(request, 'should not return null').to.not.be.null;
      expect(request, 'should not return undefined').to.not.be.undefined;
      if (!request) {
        throw Error('nothing was returned when building the request');
      }

      expect(request, "method should be 'expire'").to.have.property('method', 'expire');
      expect(request.params.pubkey, 'should have a matching pubkey').to.equal(ourNumber);
      expect(request.params.messages, 'messageHash should be in messages array').to.deep.equal(
        props.messageHashes
      );
      expect(
        request.params.expiry && isValidUnixTimestamp(request?.params.expiry),
        'expiry should be a valid unix timestamp'
      ).to.be.true;
      expect(request.params.extend, 'extend should be undefined').to.be.undefined;
      expect(request.params.shorten, 'shorten should be undefined').to.be.undefined;
      expect(request.params.signature, 'signature should not be empty').to.not.be.empty;
    });
    it('builds a request with extend enabled', async () => {
      const request: UpdateExpiryOnNodeSubRequest | null = await buildExpireRequestSingleExpiry({
        ...props,
        shortenOrExtend: 'extend',
      });

      expect(request, 'should not return null').to.not.be.null;
      expect(request, 'should not return undefined').to.not.be.undefined;
      if (!request) {
        throw Error('nothing was returned when building the request');
      }

      expect(request, "method should be 'expire'").to.have.property('method', 'expire');
      expect(request.params.pubkey, 'should have a matching pubkey').to.equal(ourNumber);
      expect(request.params.messages, 'messageHash should be in messages array').to.equal(
        props.messageHashes
      );
      expect(
        request.params.expiry && isValidUnixTimestamp(request?.params.expiry),
        'expiry should be a valid unix timestamp'
      ).to.be.true;
      expect(request.params.extend, 'extend should be true').to.be.true;
      expect(request.params.shorten, 'shorten should be undefined').to.be.undefined;
      expect(request.params.signature, 'signature should not be empty').to.not.be.empty;
    });
    it('builds a request with shorten enabled', async () => {
      const request: UpdateExpiryOnNodeSubRequest | null = await buildExpireRequestSingleExpiry({
        ...props,
        shortenOrExtend: 'shorten',
      });

      expect(request, 'should not return null').to.not.be.null;
      expect(request, 'should not return undefined').to.not.be.undefined;
      if (!request) {
        throw Error('nothing was returned when building the request');
      }

      expect(request, "method should be 'expire'").to.have.property('method', 'expire');
      expect(request.params.pubkey, 'should have a matching pubkey').to.equal(ourNumber);
      expect(request.params.messages, 'messageHash should be in messages array').to.equal(
        props.messageHashes
      );
      expect(
        request.params.expiry && isValidUnixTimestamp(request?.params.expiry),
        'expiry should be a valid unix timestamp'
      ).to.be.true;
      expect(request.params.extend, 'extend should be undefined').to.be.undefined;
      expect(request.params.shorten, 'shorten should be true').to.be.true;
      expect(request.params.signature, 'signature should not be empty').to.not.be.empty;
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

  describe('processExpireRequestResponse', () => {
    const props = {
      pubkey: '058dc8432a63f9dda4d642bfc3eb5e037838bbd779f73e0a6dfb92b8040a1e7848',
      targetNode: generateFakeSnode(),
      swarm: {
        '33c17a108940ecc353e588dc17496d63e726b8fc83c423b4840bf5c2697fa522': {
          expiry: 1696915132498,
          signature:
            'Aln2BPZoj5M0c+sdGshiKELYQRjwpjBUeoHPrmSongmxstw1RdWj0Jx/zWYOYlw6WVA1yvv9hvziceWi9gdYCA==',
          unchanged: {},
          updated: ['zwyjWbyAV3ZtSSTJSj0Ib7UbNIFxx6mXVMvnK2toIso'],
        },
        '361896969a83fffaac8c095bd0e704ba4abba5e644b324bb2de77640ab5bba64': {
          expiry: 1696915132498,
          signature:
            'vPQuyFKRgDt6IvlGT0fYgPo5nM9EGQNWETbgtnlHIxfdNbwBUNQdm2K997GdYrnO5O/R07dmOreW8LrYrO6bBw==',
          unchanged: {},
          updated: ['zwyjWbyAV3ZtSSTJSj0Ib7UbNIFxx6mXVMvnK2toIso'],
        },
        '949465ed4ba994018eedc4cd3968bf167ff95fc4c1a30dce07ed1c191a9ef8bd': {
          expiry: 1696915132498,
          signature:
            't91Zp01YcrLemy+XJllKsxjPIX9capys47XUsrwyOJEyJsHwxn4EsFqAn6bJ2jrU1NMNxJiNIacR1nNRP0w3BQ==',
          unchanged: {},
          updated: ['zwyjWbyAV3ZtSSTJSj0Ib7UbNIFxx6mXVMvnK2toIso'],
        },
        cafe02aa206a99c3699a028a3805fe9d65776f2a3588dc094d54da82f36fbb02: {
          expiry: 1696915132498,
          signature:
            'gWe9gI6b5ZLtYUcA9WV68wLEBwVvRyzJX5oiHhbPRVZMp6u6BBX0m43eA/NuCMTspSpaXZ+M3uwV6PM7QEvtDA==',
          unchanged: {},
          updated: ['zwyjWbyAV3ZtSSTJSj0Ib7UbNIFxx6mXVMvnK2toIso'],
        },
        cafe17d1dd66a01f49b69b54c7b892b31a26844fda66108fbf3a5cb8e6ed3251: {
          expiry: 1696915132498,
          signature:
            'EC+XO/lY/rVxXCC/h91n0moTuSONgn+Lb5USTb6BpvtK5fnyQUzjQto7hq8Uzf6XugM2slZDo68Xn6iNS7w+AA==',
          unchanged: {},
          updated: ['zwyjWbyAV3ZtSSTJSj0Ib7UbNIFxx6mXVMvnK2toIso'],
        },
        cafe30e590138993ec8f0c371624fa585d6c0f5f7199f34194c0e36b428814f0: {
          expiry: 1696915132498,
          signature:
            'yllKSsNTYXZVtIoQb+XVHwAiCXd5hO8/CcCtIrucFYZFiP5xRta4o0NcIsJGKTMMtgPDglug8OH0+R5bvPkKDg==',
          unchanged: {},
          updated: ['zwyjWbyAV3ZtSSTJSj0Ib7UbNIFxx6mXVMvnK2toIso'],
        },
        d9a0fe4581988bdbb3a586f0b254ef60f4e411523be6267b128d1d49bb4585bb: {
          expiry: 1696915132498,
          signature:
            'KLXME1eCdX36ByDm97Ouci4TLh7myThrDOjO4bImoWf6qvaTWwrTS/sF+7mMdbZNEhQM6IHcRZWGkZYEsEn3BQ==',
          unchanged: {},
          updated: ['zwyjWbyAV3ZtSSTJSj0Ib7UbNIFxx6mXVMvnK2toIso'],
        },
      },
      messageHashes: ['zwyjWbyAV3ZtSSTJSj0Ib7UbNIFxx6mXVMvnK2toIso'],
    };

    it('returns valid results if the response is valid', async () => {
      const results: ExpireRequestResponseResults = await processExpireRequestResponse(
        props.pubkey,
        props.targetNode,
        props.swarm,
        props.messageHashes
      );
      const [firstResultKey, firstResultValue] = Object.entries(results)[0];

      expect(results, 'should not be empty').to.be.not.empty;
      expect(firstResultValue, 'there should be at least one result').to.not.be.undefined;
      expect(
        firstResultValue.expiry,
        'there should be a matching expiry value in the result'
      ).to.equal((props.swarm as any)[firstResultKey].expiry);
      expect(
        isValidUnixTimestamp(firstResultValue.expiry),
        'the expiry value should be a valid unix timestamp'
      ).to.be.true;
      expect(
        firstResultValue.hashes[0],
        'the result hashes array should contain our messageHash'
      ).to.equal(props.messageHashes[0]);
      expect(firstResultValue.hashes, 'a result should an array of message hashes').to.be.an(
        'array'
      );
      expect(
        firstResultValue.hashes[0],
        'the result hashes array should contain our messageHash'
      ).to.equal(props.messageHashes[0]);
    });
    it('returns an error if the swarm is empty', async () => {
      try {
        await processExpireRequestResponse(props.pubkey, props.targetNode, {}, props.messageHashes);
      } catch (err) {
        expect(err.message).to.equal(
          `[processExpireRequestResponse] Swarm is missing! ${props.messageHashes}`
        );
      }
    });
  });
});
