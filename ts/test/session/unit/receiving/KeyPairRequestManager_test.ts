// tslint:disable: no-implicit-dependencies

import chai from 'chai';

import _ from 'lodash';
import { describe } from 'mocha';
import { KeyPairRequestManager } from '../../../../receiver/keyPairRequestManager';
import { TestUtils } from '../../../test-utils';

import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised as any);

chai.should();
const { expect } = chai;

// tslint:disable-next-line: max-func-body-length
describe('KeyPairRequestManager', () => {
  let inst: KeyPairRequestManager;
  beforeEach(() => {
    KeyPairRequestManager.getInstance().reset();
    inst = KeyPairRequestManager.getInstance();
  });

  it('getInstance() should return an instance', () => {
    expect(inst).to.exist;
  });

  describe('markRequestSendFor', () => {
    it('should be able to set a timestamp for a pubkey', () => {
      const groupPubkey = TestUtils.generateFakePubKey();
      const now = Date.now();
      inst.markRequestSendFor(groupPubkey, now);
      expect(inst.get(groupPubkey)).to.be.equal(now);
    });

    it('should be able to override a timestamp for a pubkey', () => {
      const groupPubkey = TestUtils.generateFakePubKey();
      const timestamp1 = Date.now();
      inst.markRequestSendFor(groupPubkey, timestamp1);
      expect(inst.get(groupPubkey)).to.be.equal(timestamp1);
      const timestamp2 = Date.now() + 1000;
      inst.markRequestSendFor(groupPubkey, timestamp2);
      expect(inst.get(groupPubkey)).to.be.equal(timestamp2);
    });
  });

  describe('canTriggerRequestWith', () => {
    it('should return true if there is no timestamp set for this pubkey', () => {
      const groupPubkey = TestUtils.generateFakePubKey();
      const can = inst.canTriggerRequestWith(groupPubkey);
      expect(can).to.be.equal(
        true,
        'should return true if we there is no timestamp set for this pubkey'
      );
    });

    it('should return false if there is a timestamp set for this pubkey and it is less than DELAY_BETWEEN_TWO_REQUEST_MS', () => {
      const groupPubkey = TestUtils.generateFakePubKey();
      const timestamp1 = Date.now();

      inst.markRequestSendFor(groupPubkey, timestamp1);
      const can = inst.canTriggerRequestWith(groupPubkey);
      expect(can).to.be.equal(
        false,
        'return false if there is a timestamp set for this pubkey and it is less than DELAY_BETWEEN_TWO_REQUEST_MS'
      );
    });

    it('should return true if there is a timestamp set for this pubkey and it is more than DELAY_BETWEEN_TWO_REQUEST_MS', () => {
      const groupPubkey = TestUtils.generateFakePubKey();
      const timestamp1 = Date.now() - KeyPairRequestManager.DELAY_BETWEEN_TWO_REQUEST_MS;

      inst.markRequestSendFor(groupPubkey, timestamp1);
      const can = inst.canTriggerRequestWith(groupPubkey);
      expect(can).to.be.equal(
        true,
        'true if there is a timestamp set for this pubkey and it is more than DELAY_BETWEEN_TWO_REQUEST_MS'
      );
    });
  });
});
