// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression

import chai from 'chai';
import * as sinon from 'sinon';
import _ from 'lodash';
import { describe } from 'mocha';

import { TestUtils } from '../../../test-utils';
import * as SNodeAPI from '../../../../../ts/session/snode_api/';

import chaiAsPromised from 'chai-as-promised';
import { OnionPaths } from '../../../../session/onions/';
import { processOnionResponse } from '../../../../session/snode_api/onions';
import AbortController from 'abort-controller';
import * as Data from '../../../../../ts/data/data';
import { Snode } from '../../../../session/snode_api/snodePool';
import { fromArrayBufferToBase64 } from '../../../../session/utils/String';
import { Onions } from '../../../../../ts/session/snode_api/';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

const getFakeResponse = (statusCode?: number, body?: string) => {
  return {
    status: statusCode || 0,
    text: async () => body || '',
  };
};

// tslint:disable-next-line: max-func-body-length
describe('OnionPathsErrors', () => {
  // Initialize new stubbed cache
  const sandbox = sinon.createSandbox();
  // tslint:disable-next-line: one-variable-per-declaration
  let guardPubkeys: Array<string>,
    otherNodesPubkeys: Array<string>,
    guard1ed: string,
    guard2ed: string,
    guard3ed: string,
    guardNodesArray: Array<Snode>,
    guardSnode1: Snode,
    otherNodesArray: Array<Snode>,
    fakeSnodePool: Array<Snode>,
    associatedWith: string,
    fakeSwarmForAssocatedWith: Array<string>;
  const fakeIP = '8.8.8.8';
  let fakePortCurrent = 20000;

  beforeEach(() => {
    guardPubkeys = TestUtils.generateFakePubKeys(3).map(n => n.key);
    otherNodesPubkeys = TestUtils.generateFakePubKeys(9).map(n => n.key);

    guard1ed = guardPubkeys[0];
    guard2ed = guardPubkeys[1];
    guard3ed = guardPubkeys[2];

    guardNodesArray = guardPubkeys.map(ed25519 => {
      fakePortCurrent++;
      return {
        ip: fakeIP,
        port: fakePortCurrent,
        pubkey_ed25519: ed25519,
        pubkey_x25519: ed25519,
        version: '',
      };
    });
    guardSnode1 = guardNodesArray[0];

    otherNodesArray = otherNodesPubkeys.map(ed25519 => {
      fakePortCurrent++;
      return {
        ip: fakeIP,
        port: fakePortCurrent,
        pubkey_ed25519: ed25519,
        pubkey_x25519: ed25519,
        version: '',
      };
    });

    fakeSnodePool = [...guardNodesArray, ...otherNodesArray];

    associatedWith = TestUtils.generateFakePubKey().key;
    fakeSwarmForAssocatedWith = otherNodesPubkeys.slice(0, 6);
    // Utils Stubs
    sandbox.stub(OnionPaths, 'selectGuardNodes').resolves(guardNodesArray);
    sandbox.stub(SNodeAPI.SNodeAPI, 'getSnodePoolFromSnode').resolves(guardNodesArray);
    TestUtils.stubData('getGuardNodes').resolves([guard1ed, guard2ed, guard3ed]);
    TestUtils.stubWindow('getSeedNodeList', () => ['seednode1']);
    sandbox.stub(SNodeAPI.SnodePool, 'refreshRandomPoolDetail').resolves(fakeSnodePool);

    OnionPaths.clearTestOnionPath();
  });

  afterEach(() => {
    TestUtils.restoreStubs();
    sandbox.restore();
  });

  describe('processOnionResponse', () => {
    it('throws a non-retryable error when the request is aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();
      try {
        await processOnionResponse(
          getFakeResponse(),
          new Uint8Array(),
          guardSnode1,
          undefined,
          abortController.signal
        );
        throw new Error('Error expected');
      } catch (e) {
        expect(e.message).to.equal('Request got aborted');
        // this makes sure that this call would not be retried
        expect(e.name).to.equal('AbortError');
      }
    });

    it('throws an non retryable error we get a 406 status code', async () => {
      try {
        await processOnionResponse(getFakeResponse(406), new Uint8Array(), guardSnode1, undefined);
        throw new Error('Error expected');
      } catch (e) {
        expect(e.message).to.equal('You clock is out of sync with the network. Check your clock.');
        // this makes sure that this call would not be retried
        expect(e.name).to.equal('AbortError');
      }
    });

    describe('processOnionResponse - 421', () => {
      it('throws a retryable error if we get a 421 status code without a new swarm', async () => {
        sandbox.stub(Data, 'getSwarmNodesForPubkey').resolves(fakeSwarmForAssocatedWith);
        const updateSwarmSpy = sandbox.stub(Data, 'updateSwarmNodesForPubkey').resolves();
        const targetNode = otherNodesPubkeys[0];

        try {
          await processOnionResponse(
            getFakeResponse(421),
            new Uint8Array(),
            guardSnode1,
            targetNode,
            undefined,
            associatedWith
          );
          throw new Error('Error expected');
        } catch (e) {
          expect(e.message).to.equal('Bad Path handled. Retry this request. Status: 421');
        }
        expect(updateSwarmSpy.callCount).to.eq(1);
        // if we don't get a new swarm in the returned json, we drop the target node considering it is a bad snode
        expect(updateSwarmSpy.args[0][1]).to.deep.eq(
          fakeSwarmForAssocatedWith.filter(m => m !== targetNode)
        );
      });

      it('throws a retryable error we get a 421 status code with a new swarm', async () => {
        sandbox.stub(Data, 'getSwarmNodesForPubkey').resolves(fakeSwarmForAssocatedWith);
        const updateSwarmSpy = sandbox.stub(Data, 'updateSwarmNodesForPubkey').resolves();
        const targetNode = otherNodesPubkeys[0];

        const resultExpected: Array<Snode> = [
          otherNodesArray[4],
          otherNodesArray[5],
          otherNodesArray[6],
        ];
        try {
          await processOnionResponse(
            getFakeResponse(421, JSON.stringify({ snodes: resultExpected })),
            new Uint8Array(),
            guardSnode1,
            targetNode,
            undefined,
            associatedWith
          );
          throw new Error('Error expected');
        } catch (e) {
          expect(e.message).to.equal('Bad Path handled. Retry this request. Status: 421');
        }
        expect(updateSwarmSpy.callCount).to.eq(1);
        // we got 3 snode in the results, this is our new swarm for this associated with pubkey
        expect(updateSwarmSpy.args[0][1]).to.deep.eq(resultExpected.map(m => m.pubkey_ed25519));
      });

      it('throws a retryable error we get a 421 status code with invalid json body', async () => {
        sandbox.stub(Data, 'getSwarmNodesForPubkey').resolves(fakeSwarmForAssocatedWith);
        const updateSwarmSpy = sandbox.stub(Data, 'updateSwarmNodesForPubkey').resolves();
        const targetNode = otherNodesPubkeys[0];

        try {
          await processOnionResponse(
            getFakeResponse(421, 'THIS IS SOME INVALID JSON'),
            new Uint8Array(),
            guardSnode1,
            targetNode,
            undefined,
            associatedWith
          );
          throw new Error('Error expected');
        } catch (e) {
          expect(e.message).to.equal('Bad Path handled. Retry this request. Status: 421');
        }
        expect(updateSwarmSpy.callCount).to.eq(1);
        // we got 3 snode in the results, this is our new swarm for this associated with pubkey
        expect(updateSwarmSpy.args[0][1]).to.deep.eq(
          fakeSwarmForAssocatedWith.filter(m => m !== targetNode)
        );
      });

      it('throws a retryable error we get a 421 status code inside the content of the json', async () => {
        sandbox.stub(Data, 'getSwarmNodesForPubkey').resolves(fakeSwarmForAssocatedWith);
        const updateSwarmSpy = sandbox.stub(Data, 'updateSwarmNodesForPubkey').resolves();
        const targetNode = otherNodesPubkeys[0];
        const json = JSON.stringify({ status: 421 });

        TestUtils.stubWindow('libloki', {
          crypto: {
            DecryptAESGCM: async (s: any, e: string) => e,
          } as any,
        });
        sandbox
          .stub(Onions, 'decodeOnionResult')
          .resolves({ plaintext: json, ciphertextBuffer: new Uint8Array() });

        try {
          await processOnionResponse(
            getFakeResponse(200, fromArrayBufferToBase64(Buffer.from(json))),
            new Uint8Array(),
            guardSnode1,
            targetNode,
            undefined,
            associatedWith
          );
          throw new Error('Error expected');
        } catch (e) {
          expect(e.message).to.equal('Bad Path handled. Retry this request. Status: 421');
        }
        expect(updateSwarmSpy.callCount).to.eq(1);
        // 421 without swarm included means drop the target node only
        expect(updateSwarmSpy.args[0][1]).to.deep.eq(
          fakeSwarmForAssocatedWith.filter(m => m !== targetNode)
        );
      });

      it('throws a retryable error we get a 421 status code inside the content of the json', async () => {
        sandbox.stub(Data, 'getSwarmNodesForPubkey').resolves(fakeSwarmForAssocatedWith);
        const updateSwarmSpy = sandbox.stub(Data, 'updateSwarmNodesForPubkey').resolves();
        const targetNode = otherNodesPubkeys[0];
        const resultExpected: Array<Snode> = [
          otherNodesArray[4],
          otherNodesArray[5],
          otherNodesArray[6],
        ];
        const json = JSON.stringify({ status: 421, snodes: resultExpected });

        TestUtils.stubWindow('libloki', {
          crypto: {
            DecryptAESGCM: async (s: any, e: string) => e,
          } as any,
        });
        sandbox
          .stub(Onions, 'decodeOnionResult')
          .resolves({ plaintext: json, ciphertextBuffer: new Uint8Array() });

        try {
          await processOnionResponse(
            getFakeResponse(200, json),
            new Uint8Array(),
            guardSnode1,
            targetNode,
            undefined,
            associatedWith
          );
          throw new Error('Error expected');
        } catch (e) {
          expect(e.message).to.equal('Bad Path handled. Retry this request. Status: 421');
        }
        expect(updateSwarmSpy.callCount).to.eq(1);
        // 421 without swarm included means drop the target node only
        expect(updateSwarmSpy.args[0][1]).to.deep.eq(resultExpected.map(m => m.pubkey_ed25519));
      });
    });
  });
});
