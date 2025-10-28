// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { generateAci } from '../../types/ServiceId.std.js';
import * as durations from '../../util/durations/index.std.js';

import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.js';

const serviceId = generateAci();

describe('isConversationUnregistered', () => {
  it('returns false if passed an undefined discoveredUnregisteredAt', () => {
    assert.isFalse(isConversationUnregistered({ serviceId }));
    assert.isFalse(
      isConversationUnregistered({
        serviceId,
        discoveredUnregisteredAt: undefined,
      })
    );
  });

  it('returns true if uuid is falsey', () => {
    assert.isTrue(
      isConversationUnregistered({
        serviceId: undefined,
        discoveredUnregisteredAt: Date.now() + 123,
      })
    );
  });

  it('returns true if passed a time fewer than 6 hours ago', () => {
    assert.isTrue(
      isConversationUnregistered({
        serviceId,
        discoveredUnregisteredAt: Date.now(),
      })
    );

    const fiveHours = 1000 * 60 * 60 * 5;
    assert.isTrue(
      isConversationUnregistered({
        serviceId,
        discoveredUnregisteredAt: Date.now() - fiveHours,
      })
    );
  });

  it('returns true if passed a time in the future', () => {
    assert.isTrue(
      isConversationUnregistered({
        serviceId,
        discoveredUnregisteredAt: Date.now() + 123,
      })
    );
  });

  it('returns false if passed a time more than 6 hours ago', () => {
    assert.isFalse(
      isConversationUnregistered({
        serviceId,
        discoveredUnregisteredAt:
          Date.now() - 6 * durations.HOUR - durations.MINUTE,
      })
    );
    assert.isFalse(
      isConversationUnregistered({
        serviceId,
        discoveredUnregisteredAt: new Date(1999, 3, 20).getTime(),
      })
    );
  });
});
