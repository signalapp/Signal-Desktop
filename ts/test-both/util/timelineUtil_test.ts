// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { times } from 'lodash';
import { v4 as uuid } from 'uuid';
import {
  fromItemIndexToRow,
  fromRowToItemIndex,
  getEphemeralRows,
  getHeroRow,
  getLastSeenIndicatorRow,
  getRowCount,
  getTypingBubbleRow,
} from '../../util/timelineUtil';

describe('<Timeline> utilities', () => {
  const getItems = (count: number): Array<string> => times(count, () => uuid());

  describe('fromItemIndexToRow', () => {
    it('returns the same number under normal conditions', () => {
      times(5, index => {
        assert.strictEqual(
          fromItemIndexToRow(index, { haveOldest: false }),
          index
        );
      });
    });

    it('adds 1 (for the hero row) if you have the oldest messages', () => {
      times(5, index => {
        assert.strictEqual(
          fromItemIndexToRow(index, { haveOldest: true }),
          index + 1
        );
      });
    });

    it('adds 1 (for the unread indicator) once crossing the unread indicator index', () => {
      const props = { haveOldest: false, oldestUnreadIndex: 2 };
      [0, 1].forEach(index => {
        assert.strictEqual(fromItemIndexToRow(index, props), index);
      });
      [2, 3, 4].forEach(index => {
        assert.strictEqual(fromItemIndexToRow(index, props), index + 1);
      });
    });

    it('can include the hero row and the unread indicator', () => {
      const props = { haveOldest: true, oldestUnreadIndex: 2 };
      [0, 1].forEach(index => {
        assert.strictEqual(fromItemIndexToRow(index, props), index + 1);
      });
      [2, 3, 4].forEach(index => {
        assert.strictEqual(fromItemIndexToRow(index, props), index + 2);
      });
    });
  });

  describe('fromRowToItemIndex', () => {
    it('returns the item index under normal conditions', () => {
      const props = { haveOldest: false, items: getItems(5) };
      times(5, row => {
        assert.strictEqual(fromRowToItemIndex(row, props), row);
      });
      assert.isUndefined(fromRowToItemIndex(5, props));
    });

    it('handles the unread indicator', () => {
      const props = {
        haveOldest: false,
        items: getItems(4),
        oldestUnreadIndex: 2,
      };

      [0, 1].forEach(row => {
        assert.strictEqual(fromRowToItemIndex(row, props), row);
      });
      assert.isUndefined(fromRowToItemIndex(2, props));
      [3, 4].forEach(row => {
        assert.strictEqual(fromRowToItemIndex(row, props), row - 1);
      });
      assert.isUndefined(fromRowToItemIndex(5, props));
    });

    it('handles the hero row', () => {
      const props = { haveOldest: true, items: getItems(3) };

      assert.isUndefined(fromRowToItemIndex(0, props));
      [1, 2, 3].forEach(row => {
        assert.strictEqual(fromRowToItemIndex(row, props), row - 1);
      });
      assert.isUndefined(fromRowToItemIndex(4, props));
    });

    it('handles the whole enchilada', () => {
      const props = {
        haveOldest: true,
        items: getItems(4),
        oldestUnreadIndex: 2,
      };

      assert.isUndefined(fromRowToItemIndex(0, props));
      [1, 2].forEach(row => {
        assert.strictEqual(fromRowToItemIndex(row, props), row - 1);
      });
      assert.isUndefined(fromRowToItemIndex(3, props));
      [4, 5].forEach(row => {
        assert.strictEqual(fromRowToItemIndex(row, props), row - 2);
      });
      assert.isUndefined(fromRowToItemIndex(6, props));
    });
  });

  describe('getRowCount', () => {
    it('returns 1 (for the hero row) if the conversation is empty', () => {
      assert.strictEqual(getRowCount({ haveOldest: true, items: [] }), 1);
    });

    it('returns the number of items under normal conditions', () => {
      assert.strictEqual(
        getRowCount({ haveOldest: false, items: getItems(4) }),
        4
      );
    });

    it('adds 1 (for the hero row) if you have the oldest messages', () => {
      assert.strictEqual(
        getRowCount({ haveOldest: true, items: getItems(4) }),
        5
      );
    });

    it('adds 1 (for the unread indicator) if you have unread messages', () => {
      assert.strictEqual(
        getRowCount({
          haveOldest: false,
          items: getItems(4),
          oldestUnreadIndex: 2,
        }),
        5
      );
    });

    it('adds 1 (for the typing contact) if you have unread messages', () => {
      assert.strictEqual(
        getRowCount({
          haveOldest: false,
          items: getItems(4),
          typingContactId: uuid(),
        }),
        5
      );
    });

    it('can have the whole enchilada', () => {
      assert.strictEqual(
        getRowCount({
          haveOldest: true,
          items: getItems(4),
          oldestUnreadIndex: 2,
          typingContactId: uuid(),
        }),
        7
      );
    });
  });

  describe('getHeroRow', () => {
    it("returns undefined if there's no hero row", () => {
      assert.isUndefined(getHeroRow({ haveOldest: false }));
    });

    it("returns 0 if there's a hero row", () => {
      assert.strictEqual(getHeroRow({ haveOldest: true }), 0);
    });
  });

  describe('getLastSeenIndicatorRow', () => {
    it('returns undefined with no unread messages', () => {
      assert.isUndefined(getLastSeenIndicatorRow({ haveOldest: false }));
      assert.isUndefined(getLastSeenIndicatorRow({ haveOldest: true }));
    });

    it('returns the same number if the oldest messages are loaded', () => {
      [0, 1, 2].forEach(oldestUnreadIndex => {
        assert.strictEqual(
          getLastSeenIndicatorRow({ haveOldest: false, oldestUnreadIndex }),
          oldestUnreadIndex
        );
      });
    });

    it("increases the number by 1 if there's a hero row", () => {
      [0, 1, 2].forEach(oldestUnreadIndex => {
        assert.strictEqual(
          getLastSeenIndicatorRow({ haveOldest: true, oldestUnreadIndex }),
          oldestUnreadIndex + 1
        );
      });
    });
  });

  describe('getTypingBubbleRow', () => {
    it('returns undefined if nobody is typing', () => {
      assert.isUndefined(
        getTypingBubbleRow({ haveOldest: false, items: getItems(3) })
      );
    });

    it('returns the last row if people are typing', () => {
      [
        { haveOldest: true, items: [], typingContactId: uuid() },
        { haveOldest: false, items: getItems(3), typingContactId: uuid() },
        { haveOldest: true, items: getItems(3), typingContactId: uuid() },
        {
          haveOldest: false,
          items: getItems(3),
          oldestUnreadIndex: 2,
          typingContactId: uuid(),
        },
        {
          haveOldest: true,
          items: getItems(3),
          oldestUnreadIndex: 2,
          typingContactId: uuid(),
        },
      ].forEach(props => {
        assert.strictEqual(getTypingBubbleRow(props), getRowCount(props) - 1);
      });
    });
  });

  describe('getEphemeralRows', () => {
    function iterate<T>(iterator: Iterator<T>): Array<T> {
      const result: Array<T> = [];
      let iteration = iterator.next();
      while (!iteration.done) {
        result.push(iteration.value);
        iteration = iterator.next();
      }
      return result;
    }

    it('yields each row under normal conditions', () => {
      const result = getEphemeralRows({
        haveOldest: false,
        items: ['a', 'b', 'c'],
      });
      assert.deepStrictEqual(iterate(result), ['item:a', 'item:b', 'item:c']);
    });

    it('yields a hero row if there is one', () => {
      const result = getEphemeralRows({ haveOldest: true, items: getItems(3) });
      const iterated = iterate(result);
      assert.lengthOf(iterated, 4);
      assert.strictEqual(iterated[0], 'hero');
    });

    it('yields an unread indicator if there is one', () => {
      const result = getEphemeralRows({
        haveOldest: false,
        items: getItems(3),
        oldestUnreadIndex: 2,
      });
      const iterated = iterate(result);
      assert.lengthOf(iterated, 4);
      assert.strictEqual(iterated[2], 'oldest-unread');
    });

    it('yields a typing row if there is one', () => {
      const result = getEphemeralRows({
        haveOldest: false,
        items: getItems(3),
        typingContactId: uuid(),
      });
      const iterated = iterate(result);
      assert.lengthOf(iterated, 4);
      assert.strictEqual(iterated[3], 'typing-contact');
    });

    it('handles the whole enchilada', () => {
      const result = getEphemeralRows({
        haveOldest: true,
        items: ['a', 'b', 'c'],
        oldestUnreadIndex: 2,
        typingContactId: uuid(),
      });
      assert.deepStrictEqual(iterate(result), [
        'hero',
        'item:a',
        'item:b',
        'oldest-unread',
        'item:c',
        'typing-contact',
      ]);
    });
  });
});
