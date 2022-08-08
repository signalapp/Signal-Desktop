// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getDefaultConversation } from '../helpers/getDefaultConversation';

import { filterAndSortConversationsByRecent } from '../../util/filterAndSortConversations';

describe('filterAndSortConversationsByRecent', () => {
  const conversations = [
    getDefaultConversation({
      title: '+16505551234',
      activeAt: 1,
    }),
    getDefaultConversation({
      title: 'Abraham Lincoln',
      activeAt: 4,
    }),
    getDefaultConversation({
      title: 'Boxing Club',
      activeAt: 3,
    }),
    getDefaultConversation({
      title: 'Not recent',
    }),
    getDefaultConversation({
      title: 'George Washington',
      e164: '+16505559876',
      activeAt: 2,
    }),
    getDefaultConversation({
      title: 'A long title ending with burrito',
    }),
  ];

  it('sorts by recency when no search term is provided', () => {
    const titles = filterAndSortConversationsByRecent(
      conversations,
      '',
      'US'
    ).map(contact => contact.title);
    assert.sameMembers(titles, [
      '+16505551234',
      'George Washington',
      'Boxing Club',
      'Abraham Lincoln',
      'Not recent',
      'A long title ending with burrito',
    ]);
  });

  it('finds a conversation when the search term is at the end of a long title', () => {
    const titles = filterAndSortConversationsByRecent(
      conversations,
      'burrito',
      'US'
    ).map(convo => convo.title);
    assert.deepEqual(titles, ['A long title ending with burrito']);
  });
});
