import { expect } from 'chai';
import Sinon from 'sinon';
import {
  getHasSeenHF190,
  getHasSeenHF191,
  handleHardforkResult,
  resetHardForkCachedValues,
} from '../../../../session/apis/snode_api/hfHandling';
import { TestUtils } from '../../../test-utils';

describe('hardfork handling', () => {
  describe('getHasSeenHF190', () => {
    afterEach(() => {
      Sinon.restore();
      resetHardForkCachedValues();
    });

    it('fetches from db if undefined, and write to db false if db value is undefined', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      const ret = await getHasSeenHF190();
      expect(ret).to.be.eq(false, 'getHasSeenHF190 should return false');

      expect(getItemById.calledOnce).to.be.eq(true, 'getItemById should have been called');
      expect(createItem.calledOnce).to.be.eq(true, 'createItem should have been called');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
    });

    it('fetches from db if undefined, and does not write to db if db value is not undefined', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves({
        id: 'getHasSeenHF190',
        value: false,
      });
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      const ret = await getHasSeenHF190();
      expect(ret).to.be.eq(false, 'getHasSeenHF190 should return false');

      expect(getItemById.calledOnce).to.be.eq(true, 'getItemById should have been called');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called');
    });

    it('fetches from db if undefined, and does not write to db if db value is not undefined - 2', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves({
        id: 'getHasSeenHF190',
        value: true,
      });
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      const ret = await getHasSeenHF190();
      expect(ret).to.be.eq(true, 'getHasSeenHF190 should return false');

      expect(getItemById.calledOnce).to.be.eq(true, 'getItemById should have been called');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called');
    });

    it('fetches from db only the value is not cached already', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves({
        id: 'getHasSeenHF190',
        value: true,
      });
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      const ret = await getHasSeenHF190();
      const ret2 = await getHasSeenHF190();
      expect(ret).to.be.eq(true, 'getHasSeenHF190 should return false');
      expect(ret2).to.be.eq(true, 'getHasSeenHF190 should return false - 2');

      expect(getItemById.calledOnce).to.be.eq(true, 'getItemById should have been called');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called');
    });
  });

  describe('getHasSeenHF191', () => {
    afterEach(() => {
      Sinon.restore();
      resetHardForkCachedValues();
    });

    it('fetches from db if undefined, and write to db false if db value is undefined', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      const ret = await getHasSeenHF191();
      expect(ret).to.be.eq(false, 'getHasSeenHF191 should return false');

      expect(getItemById.calledOnce).to.be.eq(true, 'getItemById should have been called');
      expect(createItem.calledOnce).to.be.eq(true, 'createItem should have been called');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );
    });

    it('fetches from db if undefined, and does not write to db if db value is not undefined', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves({
        id: 'getHasSeenHF191',
        value: false,
      });
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      const ret = await getHasSeenHF191();
      expect(ret).to.be.eq(false, 'getHasSeenHF191 should return false');

      expect(getItemById.calledOnce).to.be.eq(true, 'getItemById should have been called');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called');
    });

    it('fetches from db if undefined, and does not write to db if db value is not undefined - 2', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves({
        id: 'getHasSeenHF191',
        value: true,
      });
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      const ret = await getHasSeenHF191();
      expect(ret).to.be.eq(true, 'getHasSeenHF191 should return false');

      expect(getItemById.calledOnce).to.be.eq(true, 'getItemById should have been called');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called');
    });

    it('fetches from db only the value is not cached already', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves({
        id: 'getHasSeenHF191',
        value: true,
      });
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      const ret = await getHasSeenHF191();
      const ret2 = await getHasSeenHF191();
      expect(ret).to.be.eq(true, 'getHasSeenHF191 should return false');
      expect(ret2).to.be.eq(true, 'getHasSeenHF191 should return false - 2');

      expect(getItemById.calledOnce).to.be.eq(true, 'getItemById should have been called');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called');
    });
  });

  describe('handleHardforkResult', () => {
    afterEach(() => {
      Sinon.restore();
      resetHardForkCachedValues();
    });

    it('does not fail if null is given as json', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult(null as any);
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.calledTwice).to.be.eq(true, 'createItem should have been calledTwice');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );
    });

    it('does not fail on empty json object', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({});
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.calledTwice).to.be.eq(true, 'createItem should have been calledTwice');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );
    });

    it('does not fail with invalid array length of 3', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({ hf: [1, 2, 3] });
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.calledTwice).to.be.eq(true, 'createItem should have been calledTwice');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );
    });

    it('does not fail with invalid array length of 3', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({ hf: [1, 2, 3] });
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.calledTwice).to.be.eq(true, 'createItem should have been calledTwice');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );
    });

    it('does not fail with invalid array length of but not numbers', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({ hf: ['1', 2] });
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.calledTwice).to.be.eq(true, 'createItem should have been calledTwice');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );
    });

    it('does not fail with invalid array length of 1 ', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({ hf: [1] });
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.calledTwice).to.be.eq(true, 'createItem should have been calledTwice');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );
    });

    it('does not write new data if hf major is <= 18 ', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({ hf: [18, 9] });
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.calledTwice).to.be.eq(true, 'createItem should have been calledTwice');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );
    });

    it('does write new data if hf major is === 19 and minor === 0  ', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({ hf: [19, 0] });
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.calledThrice).to.be.eq(true, 'createItem should have been calledThrice');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );

      expect(createItem.args[2][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: true },
        'createItem should have been to set hasSeenHardfork191 to true in the db'
      );

      getItemById.resetHistory();
      createItem.resetHistory();
      expect(await getHasSeenHF190()).to.be.eq(true, 'getHasSeenHF190 should have been true');
      expect(getItemById.notCalled).to.be.eq(true, 'getItemById should not have been called more');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called more');
    });

    it('does write new data if hf major is === 19 and minor === 1 ', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves(undefined);
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({ hf: [19, 1] });
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.callCount).to.be.eq(4, 'createItem should have been 4');
      expect(createItem.args[0][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: false },
        'createItem should have been to set hasSeenHardfork190 to false in the db'
      );
      expect(createItem.args[1][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: false },
        'createItem should have been to set hasSeenHardfork191 to false in the db'
      );

      expect(createItem.args[2][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork190', value: true },
        'createItem should have been to set hasSeenHardfork190 to true in the db'
      );
      expect(createItem.args[3][0]).to.be.deep.eq(
        { id: 'hasSeenHardfork191', value: true },
        'createItem should have been to set hasSeenHardfork191 to true in the db'
      );
      getItemById.resetHistory();
      createItem.resetHistory();
      expect(await getHasSeenHF190()).to.be.eq(true, 'getHasSeenHF190 should have been true');
      expect(await getHasSeenHF191()).to.be.eq(true, 'getHasSeenHF191 should have been true');
      expect(getItemById.notCalled).to.be.eq(true, 'getItemById should not have been called more');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called more');
    });

    it('does not write new data if hf major is === 19 and minor === 1 but it is already known we have seen both forks ', async () => {
      const getItemById = TestUtils.stubData('getItemById').resolves({ id: '', value: true });
      const createItem = TestUtils.stubData('createOrUpdateItem').resolves();

      await handleHardforkResult({ hf: [19, 1] });
      expect(getItemById.calledTwice).to.be.eq(true, 'getItemById should have been calledTwice');
      expect(createItem.callCount).to.be.eq(0, 'createItem should have been 0');

      getItemById.resetHistory();
      createItem.resetHistory();
      expect(await getHasSeenHF190()).to.be.eq(true, 'getHasSeenHF190 should have been true');
      expect(await getHasSeenHF191()).to.be.eq(true, 'getHasSeenHF191 should have been true');
      expect(getItemById.notCalled).to.be.eq(true, 'getItemById should not have been called more');
      expect(createItem.notCalled).to.be.eq(true, 'createItem should not have been called more');
    });
  });
});
