import chai from 'chai';
import { describe } from 'mocha';
import Sinon from 'sinon';
import { filterDuplicatesFromDbAndIncomingV4 } from '../../../../../session/apis/open_group_api/opengroupV2/SogsFilterDuplicate';
import { TestUtils } from '../../../../test-utils';

const { expect } = chai;

describe('filterDuplicatesFromDbAndIncomingV4', () => {
  describe('filters already duplicated message in the same incoming batch', () => {
    beforeEach(() => {
      TestUtils.stubData('filterAlreadyFetchedOpengroupMessage').returnsArg(0);
      TestUtils.stubWindowLog();
    });

    afterEach(() => {
      Sinon.restore();
    });

    it('no duplicates', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV4();
      const msg2 = TestUtils.generateOpenGroupMessageV4();
      const msg3 = TestUtils.generateOpenGroupMessageV4();
      const filtered = await filterDuplicatesFromDbAndIncomingV4([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(3);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg2);
      expect(filtered[2]).to.be.deep.eq(msg3);
    });

    it('two duplicate sender but not the same timestamp', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV4();
      const msg2 = TestUtils.generateOpenGroupMessageV4();
      msg2.session_id = msg1.session_id;
      msg2.posted = Date.now() + 2;
      const msg3 = TestUtils.generateOpenGroupMessageV4();
      const filtered = await filterDuplicatesFromDbAndIncomingV4([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(3);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg2);
      expect(filtered[2]).to.be.deep.eq(msg3);
    });

    it('two duplicate timestamp but not the same sender', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV4();
      const msg2 = TestUtils.generateOpenGroupMessageV4();
      msg2.posted = msg1.posted;
      const msg3 = TestUtils.generateOpenGroupMessageV4();
      const filtered = await filterDuplicatesFromDbAndIncomingV4([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(3);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg2);
      expect(filtered[2]).to.be.deep.eq(msg3);
    });

    it('two duplicate timestamp but not the same sender', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV4();
      const msg2 = TestUtils.generateOpenGroupMessageV4();
      msg2.posted = msg1.posted;
      const msg3 = TestUtils.generateOpenGroupMessageV4();
      const filtered = await filterDuplicatesFromDbAndIncomingV4([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(3);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg2);
      expect(filtered[2]).to.be.deep.eq(msg3);
    });

    it('two duplicates in the same poll ', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV4();
      const msg2 = TestUtils.generateOpenGroupMessageV4();
      msg2.posted = msg1.posted;
      msg2.session_id = msg1.session_id;
      const msg3 = TestUtils.generateOpenGroupMessageV4();
      const filtered = await filterDuplicatesFromDbAndIncomingV4([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(2);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg3);
    });

    it('three duplicates in the same poll', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV4();
      const msg2 = TestUtils.generateOpenGroupMessageV4();

      const msg3 = TestUtils.generateOpenGroupMessageV4();
      msg2.posted = msg1.posted;
      msg2.session_id = msg1.session_id;
      msg3.posted = msg1.posted;
      msg3.session_id = msg1.session_id;
      const filtered = await filterDuplicatesFromDbAndIncomingV4([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(1);
      expect(filtered[0]).to.be.deep.eq(msg1);
    });
  });
});
