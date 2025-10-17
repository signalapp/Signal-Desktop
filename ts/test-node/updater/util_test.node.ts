// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isTimeToUpdate } from '../../updater/util.node.js';
import { HOUR } from '../../util/durations/index.std.js';
import { createLogger } from '../../logging/log.std.js';

const logger = createLogger('util_test');

describe('updater/util', () => {
  const now = 1745522337601;
  describe('isTimeToUpdate', () => {
    it('should update immediately if update is too far in the past', () => {
      assert.isTrue(
        isTimeToUpdate({
          logger,
          pollId: 'abc',
          releasedAt: new Date(0).getTime(),
          now,
        })
      );
    });

    it('should update immediately if release date invalid', () => {
      assert.isTrue(
        isTimeToUpdate({
          logger,
          pollId: 'abc',
          releasedAt: NaN,
          now,
        })
      );

      assert.isTrue(
        isTimeToUpdate({
          logger,
          pollId: 'abc',
          releasedAt: Infinity,
          now,
        })
      );
    });

    it('should delay the update', () => {
      assert.isFalse(
        isTimeToUpdate({
          logger,
          pollId: 'abcd',
          releasedAt: now,
          now,
        })
      );

      assert.isFalse(
        isTimeToUpdate({
          logger,
          pollId: 'abcd',
          releasedAt: now,
          now: now + HOUR,
        })
      );

      assert.isTrue(
        isTimeToUpdate({
          logger,
          pollId: 'abcd',
          releasedAt: now,
          now: now + 2 * HOUR,
        })
      );
    });

    it('should compute the delay based on pollId', () => {
      assert.isFalse(
        isTimeToUpdate({
          logger,
          pollId: 'abc',
          releasedAt: now,
          now,
        })
      );

      assert.isTrue(
        isTimeToUpdate({
          logger,
          pollId: 'abc',
          releasedAt: now,
          now: now + HOUR,
        })
      );
    });
  });
});
