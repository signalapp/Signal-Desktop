// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getDefaultConversation } from '../helpers/getDefaultConversation';

import {
  filterAndSortConversationsAlphabetically,
  filterAndSortConversationsByRecent,
} from '../../util/filterAndSortConversations';

describe('filterAndSortConversations', () => {
  const conversations = [
    getDefaultConversation({
      title: '+16505551234',
      activeAt: 1,
    }),
    getDefaultConversation({
      title: 'The Abraham Lincoln Club',
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
      title: 'A long long long title ending with burrito',
    }),
  ];

  it('filterAndSortConversationsByRecent sorts by recency when no search term is provided', () => {
    const titles = filterAndSortConversationsByRecent(
      conversations,
      '',
      'US'
    ).map(contact => contact.title);
    assert.sameOrderedMembers(titles, [
      'The Abraham Lincoln Club',
      'Boxing Club',
      'George Washington',
      '+16505551234',
      'Not recent',
      'A long long long title ending with burrito',
    ]);
  });

  it('filterAndSortConversationsAlphabetically sorts by title when no search term is provided', () => {
    const titles = filterAndSortConversationsAlphabetically(
      conversations,
      '',
      'US'
    ).map(contact => contact.title);
    assert.sameOrderedMembers(titles, [
      'A long long long title ending with burrito',
      'Boxing Club',
      'George Washington',
      'Not recent',
      'The Abraham Lincoln Club',
      '+16505551234',
    ]);
  });

  it('filterAndSortConversationsAlphabetically sorts by title when a search term is provided', () => {
    const titles = filterAndSortConversationsAlphabetically(
      conversations,
      'club',
      'US'
    ).map(contact => contact.title);
    assert.sameOrderedMembers(titles, [
      'Boxing Club',
      'The Abraham Lincoln Club',
    ]);
  });

  it('finds a conversation when the search term is at the end of a long title', () => {
    const titles = filterAndSortConversationsByRecent(
      conversations,
      'burrito',
      'US'
    ).map(convo => convo.title);
    assert.deepEqual(titles, ['A long long long title ending with burrito']);
  });
});
