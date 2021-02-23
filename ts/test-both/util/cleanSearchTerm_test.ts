// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';

describe('cleanSearchTerm', () => {
  it('should remove \\ from a search term', () => {
    const searchTerm = '\\search\\term';
    const sanitizedSearchTerm = cleanSearchTerm(searchTerm);
    assert.strictEqual(sanitizedSearchTerm, 'search* term*');
  });
});
