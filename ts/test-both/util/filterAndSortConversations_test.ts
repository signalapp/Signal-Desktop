// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { pick } from 'lodash';
import { getDefaultConversation } from '../helpers/getDefaultConversation';
import { filterAndSortConversations } from '../../util/filterAndSortConversations';
import type { ConversationType } from '../../state/ducks/conversations';

type CheckProps = Pick<ConversationType, 'title' | 'activeAt' | 'e164'>;

function check({
  searchTerm,
  input,
  expected,
}: {
  searchTerm: string;
  input: Array<CheckProps>;
  expected: Array<CheckProps>;
}) {
  const conversations = input.map(props => {
    return getDefaultConversation(props);
  });
  const results = filterAndSortConversations(conversations, searchTerm, 'US');
  const actual = results.map(convo => {
    return pick(convo, 'title', 'activeAt');
  });
  assert.sameDeepMembers(actual, expected);
}

describe('filterAndSortConversations', () => {
  it('finds a conversation by title', () => {
    check({
      searchTerm: 'yes',
      input: [{ title: 'no' }, { title: 'yes' }, { title: 'no' }],
      expected: [{ title: 'yes' }],
    });
  });

  it('finds a conversation when the search term is at the end of a long title', () => {
    check({
      searchTerm: 'burrito',
      input: [
        { title: 'no' },
        {
          title: 'A long long long title ending with burrito',
        },
        { title: 'no' },
      ],
      expected: [
        {
          title: 'A long long long title ending with burrito',
        },
      ],
    });
  });

  it('finds a conversation by phone number', () => {
    check({
      searchTerm: '9876',
      input: [
        { title: 'no', e164: undefined },
        { title: 'yes', e164: '+16505559876' },
        { title: 'no', e164: undefined },
      ],
      expected: [{ title: 'yes' }],
    });
  });

  describe('no search term', () => {
    it('sorts by recency first', () => {
      check({
        searchTerm: '',
        input: [
          { title: 'B', activeAt: 2 },
          { title: 'A', activeAt: 1 },
          { title: 'C', activeAt: 3 },
        ],
        expected: [
          { title: 'C', activeAt: 3 },
          { title: 'B', activeAt: 2 },
          { title: 'A', activeAt: 1 },
        ],
      });
    });

    it('falls back to alphabetically', () => {
      check({
        searchTerm: '',
        input: [
          { title: 'B', activeAt: 2 },
          { title: 'A', activeAt: 2 },
          { title: 'C', activeAt: 3 },
        ],
        expected: [
          { title: 'C', activeAt: 3 },
          { title: 'A', activeAt: 2 },
          { title: 'B', activeAt: 2 },
        ],
      });
    });
  });

  describe('with search term', () => {
    it('sorts by recency first', () => {
      check({
        searchTerm: 'yes',
        input: [
          { title: 'no' },
          { title: 'yes B', activeAt: 2 },
          { title: 'yes A', activeAt: 1 },
          { title: 'yes C', activeAt: 3 },
        ],
        expected: [
          { title: 'yes C', activeAt: 3 },
          { title: 'yes B', activeAt: 2 },
          { title: 'yes A', activeAt: 1 },
        ],
      });
    });

    it('falls back to alphabetically', () => {
      check({
        searchTerm: 'yes',
        input: [
          { title: 'no' },
          { title: 'yes B', activeAt: 2 },
          { title: 'yes A', activeAt: 2 },
          { title: 'yes C', activeAt: 3 },
        ],
        expected: [
          { title: 'yes C', activeAt: 3 },
          { title: 'yes A', activeAt: 2 },
          { title: 'yes B', activeAt: 2 },
        ],
      });
    });
  });
});
