// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getDefaultConversation } from '../helpers/getDefaultConversation';

import { filterAndSortContacts } from '../../util/filterAndSortContacts';

describe('filterAndSortContacts', () => {
  const conversations = [
    getDefaultConversation({
      title: '+16505551234',
      firstName: undefined,
      profileName: undefined,
    }),
    getDefaultConversation({ title: 'Carlos Santana' }),
    getDefaultConversation({ title: 'Aaron Aardvark' }),
    getDefaultConversation({ title: 'Belinda Beetle' }),
    getDefaultConversation({ title: 'Belinda Zephyr' }),
  ];

  it('without a search term, sorts conversations by title', () => {
    const titles = filterAndSortContacts(conversations, '').map(
      contact => contact.title
    );
    assert.deepEqual(titles, [
      '+16505551234',
      'Aaron Aardvark',
      'Belinda Beetle',
      'Belinda Zephyr',
      'Carlos Santana',
    ]);
  });

  it('filters conversations a search terms', () => {
    const titles = filterAndSortContacts(conversations, 'belind').map(
      contact => contact.title
    );
    assert.deepEqual(titles, ['Belinda Beetle', 'Belinda Zephyr']);
  });
});
