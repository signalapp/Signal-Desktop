// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression

import chai from 'chai';
import { describe } from 'mocha';
import Sinon from 'sinon';
import { filterDuplicatesFromDbAndIncoming } from '../../../../../session/apis/open_group_api/opengroupV2/SogsFilterDuplicate';
import { TestUtils } from '../../../../test-utils';

const { expect } = chai;

// tslint:disable-next-line: max-func-body-length
describe('filterDuplicatesFromDbAndIncoming', () => {
  describe('filters already duplicated message in the same incoming batch', () => {
    beforeEach(() => {
      TestUtils.stubData('filterAlreadyFetchedOpengroupMessage').returnsArg(0);
      TestUtils.stubWindowLog();
    });

    afterEach(() => {
      Sinon.restore();
    });

    it('no duplicates', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV2();
      const msg2 = TestUtils.generateOpenGroupMessageV2();
      const msg3 = TestUtils.generateOpenGroupMessageV2();
      const filtered = await filterDuplicatesFromDbAndIncoming([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(3);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg2);
      expect(filtered[2]).to.be.deep.eq(msg3);
    });

    it('two duplicate sender but not the same timestamp', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV2();
      const msg2 = TestUtils.generateOpenGroupMessageV2();
      msg2.sender = msg1.sender;
      msg2.sentTimestamp = Date.now() + 2;
      const msg3 = TestUtils.generateOpenGroupMessageV2();
      const filtered = await filterDuplicatesFromDbAndIncoming([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(3);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg2);
      expect(filtered[2]).to.be.deep.eq(msg3);
    });

    it('two duplicate timestamp but not the same sender', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV2();
      const msg2 = TestUtils.generateOpenGroupMessageV2();
      msg2.sentTimestamp = msg1.sentTimestamp;
      const msg3 = TestUtils.generateOpenGroupMessageV2();
      const filtered = await filterDuplicatesFromDbAndIncoming([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(3);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg2);
      expect(filtered[2]).to.be.deep.eq(msg3);
    });

    it('two duplicate timestamp but not the same sender', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV2();
      const msg2 = TestUtils.generateOpenGroupMessageV2();
      msg2.sentTimestamp = msg1.sentTimestamp;
      const msg3 = TestUtils.generateOpenGroupMessageV2();
      const filtered = await filterDuplicatesFromDbAndIncoming([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(3);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg2);
      expect(filtered[2]).to.be.deep.eq(msg3);
    });

    it('two duplicates in the same poll ', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV2();
      const msg2 = TestUtils.generateOpenGroupMessageV2();
      msg2.sentTimestamp = msg1.sentTimestamp;
      msg2.sender = msg1.sender;
      const msg3 = TestUtils.generateOpenGroupMessageV2();
      const filtered = await filterDuplicatesFromDbAndIncoming([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(2);
      expect(filtered[0]).to.be.deep.eq(msg1);
      expect(filtered[1]).to.be.deep.eq(msg3);
    });

    it('three duplicates in the same poll', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV2();
      const msg2 = TestUtils.generateOpenGroupMessageV2();

      const msg3 = TestUtils.generateOpenGroupMessageV2();
      msg2.sentTimestamp = msg1.sentTimestamp;
      msg2.sender = msg1.sender;
      msg3.sentTimestamp = msg1.sentTimestamp;
      msg3.sender = msg1.sender;
      const filtered = await filterDuplicatesFromDbAndIncoming([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(1);
      expect(filtered[0]).to.be.deep.eq(msg1);
    });

    it('three duplicates in the same poll', async () => {
      const msg1 = TestUtils.generateOpenGroupMessageV2();
      const msg2 = TestUtils.generateOpenGroupMessageV2();

      const msg3 = TestUtils.generateOpenGroupMessageV2();
      msg2.sentTimestamp = msg1.sentTimestamp;
      msg2.sender = msg1.sender;
      msg3.sentTimestamp = msg1.sentTimestamp;
      msg3.sender = msg1.sender;
      const filtered = await filterDuplicatesFromDbAndIncoming([msg1, msg2, msg3]);
      expect(filtered.length).to.be.eq(1);
      expect(filtered[0]).to.be.deep.eq(msg1);
    });
  });

  describe('filters duplicated message from database', () => {
    //sadly better-sqlite3 does not allow us to easily create an in memory db for now (issues with sqlite binary)
    // so testing this part is not easy as all the logic is made in sqlite
    // tslint:disable-next-line: no-empty
    it.skip('in memory database', () => {});
  });
});
