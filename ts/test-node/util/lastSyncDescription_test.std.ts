// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import i18n from '../util/i18n.node.ts';
import { getLastSyncDescription } from '../../util/lastSyncDescription.std.ts';

describe('getLastSyncDescription', () => {
  it('describes a real last-sync timestamp with its date and time', () => {
    const timestamp = 1700000000000;
    const expected = new Date(timestamp);

    const result = getLastSyncDescription(i18n, timestamp);

    assert.include(result, 'Last import at');
    assert.include(result, expected.toLocaleDateString());
    assert.include(result, expected.toLocaleTimeString());
  });

  it('currently renders the unix epoch for an undefined last-sync time', () => {
    const result = getLastSyncDescription(i18n, undefined);

    assert.include(result, 'Last import at');
    assert.include(result, new Date(0).toLocaleDateString());
  });

  it('currently renders the unix epoch for a last-sync time of 0', () => {
    const result = getLastSyncDescription(i18n, 0);

    assert.include(result, new Date(0).toLocaleDateString());
  });
});
