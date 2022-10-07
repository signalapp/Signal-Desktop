import { expect } from 'chai';
import Sinon from 'sinon';
import { sogsRollingDeletions } from '../../../../session/apis/open_group_api/sogsv3/sogsRollingDeletions';

describe('sogsRollingDeletions', () => {
  beforeEach(() => {
    sogsRollingDeletions.emptyMessageDeleteIds();
    Sinon.stub(sogsRollingDeletions, 'getPerRoomCount').returns(5);
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('no items at all returns false', () => {
    expect(sogsRollingDeletions.hasMessageDeletedId('convo1', 1)).to.be.equal(
      false,
      '1 should not be there'
    );
  });

  it('no items in that convo returns false', () => {
    sogsRollingDeletions.addMessageDeletedId('convo1', 1);

    expect(sogsRollingDeletions.hasMessageDeletedId('convo2', 1)).to.be.equal(
      false,
      '1 should not be there'
    );
  });

  it('can add 1 item', () => {
    sogsRollingDeletions.addMessageDeletedId('convo1', 1);
    expect(sogsRollingDeletions.hasMessageDeletedId('convo1', 1)).to.be.equal(
      true,
      '1 should be there'
    );
  });

  it('can add more than capacity items', () => {
    sogsRollingDeletions.addMessageDeletedId('convo1', 1);
    sogsRollingDeletions.addMessageDeletedId('convo1', 2);
    sogsRollingDeletions.addMessageDeletedId('convo1', 3);
    sogsRollingDeletions.addMessageDeletedId('convo1', 4);
    sogsRollingDeletions.addMessageDeletedId('convo1', 5);
    sogsRollingDeletions.addMessageDeletedId('convo1', 6);
    expect(sogsRollingDeletions.hasMessageDeletedId('convo1', 1)).to.be.equal(
      false,
      '1 should not be there'
    );
    expect(sogsRollingDeletions.hasMessageDeletedId('convo1', 2)).to.be.equal(
      true,
      '2 should be there'
    );
    expect(sogsRollingDeletions.hasMessageDeletedId('convo1', 3)).to.be.equal(
      true,
      '3 should be there'
    );
    expect(sogsRollingDeletions.hasMessageDeletedId('convo1', 4)).to.be.equal(
      true,
      '4 should be there'
    );
    expect(sogsRollingDeletions.hasMessageDeletedId('convo1', 5)).to.be.equal(
      true,
      '5 should be there'
    );
    expect(sogsRollingDeletions.hasMessageDeletedId('convo1', 6)).to.be.equal(
      true,
      '6 should be there'
    );
  });
});
