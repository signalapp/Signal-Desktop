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

  it('says contacts were never imported for an undefined last-sync time', () => {
    const result = getLastSyncDescription(i18n, undefined);

    assert.equal(result, 'Last import: never');
  });

  it('says contacts were never imported for a last-sync time of 0', () => {
    const result = getLastSyncDescription(i18n, 0);

    assert.equal(result, 'Last import: never');
  });

  it('does not say never for a last-sync time of 1', () => {
    const result = getLastSyncDescription(i18n, 1);

    assert.include(result, 'Last import at');
    assert.notInclude(result, 'never');
  });
});
