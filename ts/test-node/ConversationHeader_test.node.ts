import { assert } from 'chai';
import sinon from 'sinon';

import { itemStorage } from '../textsecure/Storage.preload.js';
import { isSASEnabled } from '../components/conversation/ConversationHeader.dom.js';

describe('isSASEnabled', () => {
  let stub: sinon.SinonStub;

  beforeEach(() => {
    stub = sinon.stub(itemStorage, 'get');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns true when enabled', () => {
    stub.withArgs('sas-enabled', true).returns(true);
    assert.isTrue(isSASEnabled());
  });

  it('returns false when disabled', () => {
    stub.withArgs('sas-enabled', true).returns(false);
    assert.isFalse(isSASEnabled());
  });

  it('uses default value when missing', () => {
    stub.withArgs('sas-enabled', true).returns(false);
    assert.isFalse(isSASEnabled());
  });
});