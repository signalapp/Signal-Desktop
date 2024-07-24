import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { describe } from 'mocha';
import Sinon from 'sinon';

import { Onions, SnodePool } from '../../../../session/apis/snode_api';
import { TestUtils } from '../../../test-utils';

import { Snode } from '../../../../data/types';
import { SeedNodeAPI } from '../../../../session/apis/seed_node_api';
import { SnodeFromSeed } from '../../../../session/apis/seed_node_api/SeedNodeAPI';
import * as OnionPaths from '../../../../session/onions/onionPath';
import { generateFakeSnodes, generateFakeSnodeWithEdKey } from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

const guard1ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f9161534e';
const guard2ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f91615349';
const guard3ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f9161534a';

const fakeSnodePool: Array<Snode> = [
  ...generateFakeSnodes(12),
  generateFakeSnodeWithEdKey(guard1ed),
  generateFakeSnodeWithEdKey(guard2ed),
  generateFakeSnodeWithEdKey(guard3ed),
  ...generateFakeSnodes(3),
];

const fakeSnodePoolFromSeedNode: Array<SnodeFromSeed> = fakeSnodePool.map(m => {
  return {
    public_ip: m.ip,
    storage_port: m.port,
    pubkey_x25519: m.pubkey_x25519,
    pubkey_ed25519: m.pubkey_ed25519,
    storage_server_version: m.storage_server_version,
  };
});

describe('SeedNodeAPI', () => {
  // Initialize new stubbed cache

  describe('getSnodeListFromSeednode', () => {
    beforeEach(() => {
      // Utils Stubs
      OnionPaths.clearTestOnionPath();

      TestUtils.stubWindowLog();

      Onions.resetSnodeFailureCount();
      OnionPaths.resetPathFailureCount();
      SnodePool.TEST_resetState();
    });

    afterEach(() => {
      Sinon.restore();
    });

    it('if the cached snode pool has less than 12 snodes, trigger a fetch from the seed nodes with retries', async () => {
      const TEST_fetchSnodePoolFromSeedNodeRetryable = Sinon.stub(
        SeedNodeAPI,
        'TEST_fetchSnodePoolFromSeedNodeRetryable'
      )
        .onFirstCall()
        .throws()
        .onSecondCall()
        .resolves(fakeSnodePoolFromSeedNode);

      Sinon.stub(SeedNodeAPI, 'getMinTimeout').returns(20);

      // run the command
      const fetched = await SeedNodeAPI.fetchSnodePoolFromSeedNodeWithRetries(['seednode1']);

      const sortedFetch = fetched.sort((a, b) => (a.pubkey_ed25519 > b.pubkey_ed25519 ? -1 : 1));
      const sortedFakeSnodePool = fakeSnodePool.sort((a, b) =>
        a.pubkey_ed25519 > b.pubkey_ed25519 ? -1 : 1
      );
      expect(sortedFetch).to.deep.equal(sortedFakeSnodePool);

      expect(
        TEST_fetchSnodePoolFromSeedNodeRetryable.callCount,
        'TEST_fetchSnodePoolFromSeedNodeRetryable called twice as the first one failed'
      ).to.be.eq(2);
    });
  });
});
