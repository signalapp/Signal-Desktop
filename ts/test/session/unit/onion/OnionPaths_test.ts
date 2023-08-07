import chai from 'chai';
import Sinon from 'sinon';
import _ from 'lodash';
import { describe } from 'mocha';
import chaiAsPromised from 'chai-as-promised';

import { TestUtils } from '../../../test-utils';
import * as SNodeAPI from '../../../../session/apis/snode_api';

import * as OnionPaths from '../../../../session/onions/onionPath';
import { GuardNode, Snode } from '../../../../data/data';
import {
  generateFakeSnodes,
  generateFakeSnodeWithEdKey,
  stubData,
} from '../../../test-utils/utils';
import { SeedNodeAPI } from '../../../../session/apis/seed_node_api';
import { ServiceNodesList } from '../../../../session/apis/snode_api/getServiceNodesList';

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
  ...generateFakeSnodes(9),
];

const fakeGuardNodesEd25519 = [guard1ed, guard2ed, guard3ed];
const fakeGuardNodes = fakeSnodePool.filter(m => fakeGuardNodesEd25519.includes(m.pubkey_ed25519));
const fakeGuardNodesFromDB: Array<GuardNode> = fakeGuardNodesEd25519.map(ed25519PubKey => {
  return {
    ed25519PubKey,
  };
});

describe('OnionPaths', () => {
  // Initialize new stubbed cache
  let oldOnionPaths: Array<Array<Snode>>;

  describe('dropSnodeFromPath', () => {
    beforeEach(async () => {
      // Utils Stubs
      OnionPaths.clearTestOnionPath();

      Sinon.stub(OnionPaths, 'selectGuardNodes').resolves(fakeGuardNodes);
      Sinon.stub(ServiceNodesList, 'getSnodePoolFromSnode').resolves(fakeGuardNodes);
      stubData('getSnodePoolFromDb').resolves(fakeSnodePool);

      TestUtils.stubData('getGuardNodes').resolves(fakeGuardNodesFromDB);
      TestUtils.stubData('createOrUpdateItem').resolves();
      TestUtils.stubWindow('getSeedNodeList', () => ['seednode1']);

      TestUtils.stubWindowLog();

      Sinon.stub(SeedNodeAPI, 'fetchSnodePoolFromSeedNodeWithRetries').resolves(fakeSnodePool);
      SNodeAPI.Onions.resetSnodeFailureCount();
      OnionPaths.resetPathFailureCount();
      // get a copy of what old ones look like
      await OnionPaths.getOnionPath({});

      oldOnionPaths = OnionPaths.TEST_getTestOnionPath();
      if (oldOnionPaths.length !== 3) {
        throw new Error(`onion path length not enough ${oldOnionPaths.length}`);
      }
      // this just triggers a build of the onionPaths
    });

    afterEach(() => {
      Sinon.restore();
    });
    describe('with valid snode pool', () => {
      it('rebuilds after removing last snode on path', async () => {
        await OnionPaths.dropSnodeFromPath(oldOnionPaths[2][2].pubkey_ed25519);
        const newOnionPath = OnionPaths.TEST_getTestOnionPath();

        // only the last snode should have been updated
        expect(newOnionPath).to.be.not.deep.equal(oldOnionPaths);
        expect(newOnionPath[0]).to.be.deep.equal(oldOnionPaths[0]);
        expect(newOnionPath[1]).to.be.deep.equal(oldOnionPaths[1]);
        expect(newOnionPath[2][0]).to.be.deep.equal(oldOnionPaths[2][0]);
        expect(newOnionPath[2][1]).to.be.deep.equal(oldOnionPaths[2][1]);
        expect(newOnionPath[2][2]).to.be.not.deep.equal(oldOnionPaths[2][2]);
      });

      it('rebuilds after removing middle snode on path', async () => {
        await OnionPaths.dropSnodeFromPath(oldOnionPaths[2][1].pubkey_ed25519);
        const newOnionPath = OnionPaths.TEST_getTestOnionPath();

        const allEd25519Keys = _.flattenDeep(oldOnionPaths).map(m => m.pubkey_ed25519);

        // only the last snode should have been updated
        expect(newOnionPath).to.be.not.deep.equal(oldOnionPaths);
        expect(newOnionPath[0]).to.be.deep.equal(oldOnionPaths[0]);
        expect(newOnionPath[1]).to.be.deep.equal(oldOnionPaths[1]);
        expect(newOnionPath[2][0]).to.be.deep.equal(oldOnionPaths[2][0]);
        // last item moved to the position one as we removed item 1 and happened one after it
        expect(newOnionPath[2][1]).to.be.deep.equal(oldOnionPaths[2][2]);
        // the last item we happened must not be any of the new path nodes.
        // actually, we remove the nodes causing issues from the snode pool so we shouldn't find this one neither
        expect(allEd25519Keys).to.not.include(newOnionPath[2][2].pubkey_ed25519);
      });
    });
  });
});
