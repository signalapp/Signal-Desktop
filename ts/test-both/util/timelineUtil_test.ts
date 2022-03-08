// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import { MINUTE, SECOND } from '../../util/durations';
import { areMessagesInSameGroup } from '../../util/timelineUtil';

describe('<Timeline> utilities', () => {
  describe('areMessagesInSameGroup', () => {
    const defaultNewer = {
      type: 'message' as const,
      data: {
        author: { id: uuid() },
        timestamp: new Date(1998, 10, 21, 12, 34, 56, 123).valueOf(),
      },
    };
    const defaultOlder = {
      ...defaultNewer,
      data: {
        ...defaultNewer.data,
        timestamp: defaultNewer.data.timestamp - MINUTE,
      },
    };

    it('returns false if either item is missing', () => {
      assert.isFalse(areMessagesInSameGroup(undefined, false, undefined));
      assert.isFalse(areMessagesInSameGroup(defaultNewer, false, undefined));
      assert.isFalse(areMessagesInSameGroup(undefined, false, defaultNewer));
    });

    it('returns false if either item is not a message', () => {
      const linkNotification = {
        type: 'linkNotification' as const,
        data: null,
        timestamp: Date.now(),
      };

      assert.isFalse(
        areMessagesInSameGroup(defaultNewer, false, linkNotification)
      );
      assert.isFalse(
        areMessagesInSameGroup(linkNotification, false, defaultNewer)
      );
      assert.isFalse(
        areMessagesInSameGroup(linkNotification, false, linkNotification)
      );
    });

    it("returns false if authors don't match", () => {
      const older = {
        ...defaultOlder,
        data: { ...defaultOlder.data, author: { id: uuid() } },
      };

      assert.isFalse(areMessagesInSameGroup(older, false, defaultNewer));
    });

    it('returns false if the older item was sent more than 3 minutes before', () => {
      const older = {
        ...defaultNewer,
        data: {
          ...defaultNewer.data,
          timestamp: defaultNewer.data.timestamp - 3 * MINUTE - SECOND,
        },
      };

      assert.isFalse(areMessagesInSameGroup(older, false, defaultNewer));
    });

    it('returns false if the older item was somehow sent in the future', () => {
      assert.isFalse(areMessagesInSameGroup(defaultNewer, false, defaultOlder));
    });

    it("returns false if the older item was sent across a day boundary, even if they're otherwise <3m apart", () => {
      const older = {
        ...defaultOlder,
        data: {
          ...defaultOlder.data,
          timestamp: new Date(2000, 2, 2, 23, 59, 0, 0).valueOf(),
        },
      };
      const newer = {
        ...defaultNewer,
        data: {
          ...defaultNewer.data,
          timestamp: new Date(2000, 2, 3, 0, 1, 0, 0).valueOf(),
        },
      };
      assert.isBelow(
        newer.data.timestamp - older.data.timestamp,
        3 * MINUTE,
        'Test was set up incorrectly'
      );

      assert.isFalse(areMessagesInSameGroup(older, false, newer));
    });

    it('returns false if the older item has reactions', () => {
      const older = {
        ...defaultOlder,
        data: { ...defaultOlder.data, reactions: [{}] },
      };

      assert.isFalse(areMessagesInSameGroup(older, false, defaultNewer));
    });

    it("returns false if there's an unread indicator in the middle", () => {
      assert.isFalse(areMessagesInSameGroup(defaultOlder, true, defaultNewer));
    });

    it('returns true if the everything above works out', () => {
      assert.isTrue(areMessagesInSameGroup(defaultOlder, false, defaultNewer));
    });
  });
});
