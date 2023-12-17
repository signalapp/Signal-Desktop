import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Sinon from 'sinon';
import {
  GetExpiriesFromNodeSubRequest,
  fakeHash,
} from '../../../../session/apis/snode_api/SnodeRequestTypes';
import {
  GetExpiriesFromSnodeProps,
  GetExpiriesRequestResponseResults,
  buildGetExpiriesRequest,
  processGetExpiriesRequestResponse,
} from '../../../../session/apis/snode_api/getExpiriesRequest';
import { GetNetworkTime } from '../../../../session/apis/snode_api/getNetworkTime';
import { SnodeSignature } from '../../../../session/apis/snode_api/snodeSignatures';
import { UserUtils } from '../../../../session/utils';
import { isValidUnixTimestamp } from '../../../../session/utils/Timestamps';
import { TypedStub, generateFakeSnode, stubWindowLog } from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);

describe('GetExpiriesRequest', () => {
  stubWindowLog();

  const getLatestTimestampOffset = 200000;
  const ourNumber = '37e1631b002de498caf7c5c1712718bde7f257c6dadeed0c21abf5e939e6c309';
  const ourUserEd25516Keypair = {
    pubKey: '37e1631b002de498caf7c5c1712718bde7f257c6dadeed0c21abf5e939e6c309',
    privKey:
      'be1d11154ff9b6de77873f0b6b0bcc460000000000000000000000000000000037e1631b002de498caf7c5c1712718bde7f257c6dadeed0c21abf5e939e6c309',
  };

  let getOurPubKeyStrFromCacheStub: TypedStub<typeof UserUtils, 'getOurPubKeyStrFromCache'>;

  beforeEach(() => {
    Sinon.stub(GetNetworkTime, 'getLatestTimestampOffset').returns(getLatestTimestampOffset);
    getOurPubKeyStrFromCacheStub = Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(
      ourNumber
    );
    Sinon.stub(UserUtils, 'getUserED25519KeyPair').resolves(ourUserEd25516Keypair);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('buildGetExpiriesRequest', () => {
    const props: GetExpiriesFromSnodeProps = {
      messageHashes: ['messageHash'],
    };

    it('builds a valid request given the messageHashes and valid timestamp for now', async () => {
      const request: GetExpiriesFromNodeSubRequest | null = await buildGetExpiriesRequest(props);

      expect(request, 'should not return null').to.not.be.null;
      expect(request, 'should not return undefined').to.not.be.undefined;
      if (!request) {
        throw Error('nothing was returned when getting the expiries');
      }

      expect(request, "method should be 'get_expiries'").to.have.property('method', 'get_expiries');
      expect(request.params.pubkey, 'should have a matching pubkey').to.equal(ourNumber);
      expect(request.params.messages, 'messageHashes should match our input').to.deep.equal(
        props.messageHashes
      );
      expect(
        request.params.timestamp && isValidUnixTimestamp(request?.params.timestamp),
        'the timestamp should be a valid unix timestamp'
      ).to.be.true;
      expect(request.params.signature, 'signature should not be empty').to.not.be.empty;
    });
    it('fails to build a request if our pubkey is missing', async () => {
      // Modify the stub behavior for this test only we need to return an unsupported type to simulate a missing pubkey
      (getOurPubKeyStrFromCacheStub as any).returns(undefined);

      const request: GetExpiriesFromNodeSubRequest | null = await buildGetExpiriesRequest(props);

      expect(request, 'should return null').to.be.null;
    });
    it('fails to build a request if our signature is missing', async () => {
      // Modify the stub behavior for this test only we need to return an unsupported type to simulate a missing pubkey
      Sinon.stub(SnodeSignature, 'generateGetExpiriesSignature').resolves(null);

      const request: GetExpiriesFromNodeSubRequest | null = await buildGetExpiriesRequest(props);

      expect(request, 'should return null').to.be.null;
    });
  });

  describe('processGetExpiriesRequestResponse', () => {
    const props = {
      targetNode: generateFakeSnode(),
      expiries: { 'FLTUh/C/6E+sWRgNtrqWPXhQqKlIrpHVKJJtZsBMWKw': 1696983251624 },
      // FIXME There is a bug in the snode code that requires at least 2 messages to be requested. Will be fixed in next storage server release
      messageHashes: ['FLTUh/C/6E+sWRgNtrqWPXhQqKlIrpHVKJJtZsBMWKw', fakeHash],
    };

    it('returns valid results if the response is valid', async () => {
      const results: GetExpiriesRequestResponseResults = await processGetExpiriesRequestResponse(
        props.targetNode,
        props.expiries,
        props.messageHashes
      );
      const [firstResultKey, firstResultValue] = Object.entries(results)[0];

      expect(results, 'should not be empty').to.be.not.empty;
      expect(firstResultValue, 'there should be at least one result').to.not.be.undefined;
      expect(firstResultValue, 'there should be a matching expiry value in the result').to.equal(
        (props.expiries as any)[firstResultKey]
      );
      expect(
        isValidUnixTimestamp(firstResultValue),
        'the expiry value should be a valid unix timestamp'
      ).to.be.true;
      expect(firstResultKey, 'the result hash key should match our messageHash').to.equal(
        props.messageHashes[0]
      );
    });
    it('returns an error if expiries is empty', async () => {
      try {
        await processGetExpiriesRequestResponse(props.targetNode, {}, props.messageHashes);
      } catch (err) {
        expect(err.message).to.equal(
          `[processGetExpiriesRequestResponse] Expiries are missing! ${JSON.stringify(
            props.messageHashes
          )}`
        );
      }
    });
  });
});
