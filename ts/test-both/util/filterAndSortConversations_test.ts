// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getDefaultConversation } from '../helpers/getDefaultConversation';

import {
  filterAndSortConversationsByTitle,
  filterAndSortConversationsByRecent,
} from '../../util/filterAndSortConversations';

describe('filterAndSortConversationsByTitle', () => {
  const conversations = [
    getDefaultConversation({
      title: '+16505551234',
      e164: '+16505551234',
      name: undefined,
      profileName: undefined,
    }),
    getDefaultConversation({
      name: 'Carlos Santana',
      title: 'Carlos Santana',
      e164: '+16505559876',
      username: 'thisismyusername',
    }),
    getDefaultConversation({
      name: 'Aaron Aardvark',
      title: 'Aaron Aardvark',
    }),
    getDefaultConversation({
      name: 'Belinda Beetle',
      title: 'Belinda Beetle',
    }),
    getDefaultConversation({
      name: 'Belinda Zephyr',
      title: 'Belinda Zephyr',
    }),
  ];

  it('without a search term, sorts conversations by title (but puts no-name contacts at the bottom)', () => {
    const titles = filterAndSortConversationsByTitle(conversations, '').map(
      contact => contact.title
    );
    assert.deepEqual(titles, [
      'Aaron Aardvark',
      'Belinda Beetle',
      'Belinda Zephyr',
      'Carlos Santana',
      '+16505551234',
    ]);
  });

  it('can search for contacts by title', () => {
    const titles = filterAndSortConversationsByTitle(
      conversations,
      'belind'
    ).map(contact => contact.title);
    assert.sameMembers(titles, ['Belinda Beetle', 'Belinda Zephyr']);
  });

  it('can search for contacts by phone number (and puts no-name contacts at the bottom)', () => {
    const titles = filterAndSortConversationsByTitle(
      conversations,
      '650555'
    ).map(contact => contact.title);
    assert.sameMembers(titles, ['Carlos Santana', '+16505551234']);
  });

  it('can search for contacts by username', () => {
    const titles = filterAndSortConversationsByTitle(
      conversations,
      'thisis'
    ).map(contact => contact.title);
    assert.sameMembers(titles, ['Carlos Santana']);
  });
});

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
  ];

  it('sorts by recency when no search term is provided', () => {
    const titles = filterAndSortConversationsByRecent(conversations, '').map(
      contact => contact.title
    );
    assert.sameMembers(titles, [
      '+16505551234',
      'George Washington',
      'Boxing Club',
      'Abraham Lincoln',
      'Not recent',
    ]);
  });
});
