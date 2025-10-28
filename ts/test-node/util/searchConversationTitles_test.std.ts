// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';
import { searchConversationTitles } from '../../util/searchConversationTitles.std.js';

describe('searchContactTitles', () => {
  const conversations = [
    getDefaultConversation({
      title: 'Ally Apple',
    }),
    getDefaultConversation({
      title: 'Betty Banana',
    }),
    getDefaultConversation({
      title: 'Catty Cantaloupe',
    }),
    getDefaultConversation({
      title: 'Debby Dancing Date',
    }),
  ];

  function assertSearchEquals(
    terms: Array<string>,
    expectedTitles: Array<string>,
    message?: string
  ) {
    const titles = searchConversationTitles(conversations, terms).map(
      contact => contact.title
    );

    assert.sameMembers(titles, expectedTitles, message);
  }

  it('matches full name components', () => {
    assertSearchEquals(['ally'], ['Ally Apple'], 'first name');
    assertSearchEquals(['apple'], ['Ally Apple'], 'last name');
    assertSearchEquals(['danc'], ['Debby Dancing Date'], 'middle name');
  });

  it('matches based on name component prefix', () => {
    assertSearchEquals(['all'], ['Ally Apple']);
    assertSearchEquals(['app'], ['Ally Apple']);
  });

  it('does not return single character matches', () => {
    assertSearchEquals(['a'], []);
    assertSearchEquals([], []);
  });

  it('only returns prefix matches', () => {
    assertSearchEquals(['lly'], []);
    assertSearchEquals(['anana'], []);
  });
});
