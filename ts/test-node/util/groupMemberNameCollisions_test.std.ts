// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.js';

import {
  dehydrateCollisionsWithConversations,
  getCollisionsFromMemberships,
  hasUnacknowledgedCollisions,
  invertIdsByTitle,
} from '../../util/groupMemberNameCollisions.std.js';

describe('group member name collision utilities', () => {
  describe('dehydrateCollisionsWithConversations', () => {
    it('turns conversations into "plain" IDs', () => {
      const conversation1 = getDefaultConversation();
      const conversation2 = getDefaultConversation();
      const conversation3 = getDefaultConversation();
      const conversation4 = getDefaultConversation();

      const result = dehydrateCollisionsWithConversations({
        Alice: [conversation1, conversation2],
        Bob: [conversation3, conversation4],
      });

      assert.deepEqual(result, {
        Alice: [conversation1.id, conversation2.id],
        Bob: [conversation3.id, conversation4.id],
      });
    });
  });

  describe('getCollisionsFromMemberships', () => {
    it('finds collisions by title, omitting some conversations', () => {
      const alice1 = getDefaultConversation({
        profileName: 'Alice',
        title: 'Alice',
      });
      const alice2 = getDefaultConversation({
        profileName: 'Alice',
        title: 'Alice',
      });
      const bob1 = getDefaultConversation({
        profileName: 'Bob',
        title: 'Bob',
      });
      const bob2 = getDefaultConversation({
        name: 'Bob In Your Contacts',
        profileName: 'Bob',
        title: 'Bob',
      });
      const bob3 = getDefaultConversation({
        profileName: 'Bob',
        title: 'Bob',
      });

      // Ignored, because Bob is not in your contacts (lacks `name`), has no profile name,
      //   and has no E164.
      const ignoredBob = getDefaultConversation({
        e164: undefined,
        title: 'Bob',
      });

      // Ignored, because there's only one Charlie.
      const charlie = getDefaultConversation({
        profileName: 'Charlie',
        title: 'Charlie',
      });

      // Ignored, because all Donnas are in your contacts (they have a `name`).
      const donna1 = getDefaultConversation({
        name: 'Donna One',
        profileName: 'Donna',
        title: 'Donna',
      });
      const donna2 = getDefaultConversation({
        name: 'Donna Two',
        profileName: 'Donna',
        title: 'Donna',
      });
      const donna3 = getDefaultConversation({
        name: 'Donna Three',
        profileName: 'Donna',
        title: 'Donna',
      });

      // Ignored, because you're not included.
      const me = getDefaultConversation({
        isMe: true,
        profileName: 'Alice',
        title: 'Alice',
      });

      const memberships = [
        alice1,
        alice2,
        bob1,
        bob2,
        bob3,
        ignoredBob,
        charlie,
        donna1,
        donna2,
        donna3,
        me,
      ].map(member => ({ member }));

      const result = getCollisionsFromMemberships(memberships);

      assert.deepEqual(result, {
        Alice: [alice1, alice2],
        Bob: [bob1, bob2, bob3],
      });
    });
  });

  describe('hasUnacknowledgedCollisions', () => {
    it('returns false if the collisions are identical', () => {
      assert.isFalse(hasUnacknowledgedCollisions({}, {}));
      assert.isFalse(
        hasUnacknowledgedCollisions(
          { Alice: ['abc', 'def'] },
          { Alice: ['abc', 'def'] }
        )
      );
      assert.isFalse(
        hasUnacknowledgedCollisions(
          { Alice: ['abc', 'def'] },
          { Alice: ['def', 'abc'] }
        )
      );
    });

    it('returns false if the acknowledged collisions are a superset of the current collisions', () => {
      assert.isFalse(
        hasUnacknowledgedCollisions({ Alice: ['abc', 'def'] }, {})
      );
      assert.isFalse(
        hasUnacknowledgedCollisions(
          { Alice: ['abc', 'def', 'geh'] },
          { Alice: ['abc', 'geh'] }
        )
      );
      assert.isFalse(
        hasUnacknowledgedCollisions(
          { Alice: ['abc', 'def'], Bob: ['ghi', 'jkl'] },
          { Alice: ['abc', 'def'] }
        )
      );
    });

    it('returns true if the current collisions has a title that was not acknowledged', () => {
      assert.isTrue(
        hasUnacknowledgedCollisions(
          { Alice: ['abc', 'def'], Bob: ['ghi', 'jkl'] },
          {
            Alice: ['abc', 'def'],
            Bob: ['ghi', 'jkl'],
            Charlie: ['mno', 'pqr'],
          }
        )
      );
      assert.isTrue(
        hasUnacknowledgedCollisions(
          { Alice: ['abc', 'def'], Bob: ['ghi', 'jkl'] },
          {
            Alice: ['abc', 'def'],
            Charlie: ['mno', 'pqr'],
          }
        )
      );
    });

    it('returns true if any title has a new ID', () => {
      assert.isTrue(
        hasUnacknowledgedCollisions(
          { Alice: ['abc', 'def'] },
          { Alice: ['abc', 'def', 'ghi'] }
        )
      );
      assert.isTrue(
        hasUnacknowledgedCollisions(
          { Alice: ['abc', 'def'] },
          { Alice: ['abc', 'ghi'] }
        )
      );
    });
  });

  describe('invertIdsByTitle', () => {
    it('returns an empty object if passed no IDs', () => {
      assert.deepEqual(invertIdsByTitle({}), {});
      assert.deepEqual(invertIdsByTitle({ Alice: [] }), {});
    });

    it('returns an object with ID keys and title values', () => {
      assert.deepEqual(
        invertIdsByTitle({ Alice: ['abc', 'def'], Bob: ['ghi', 'jkl', 'mno'] }),
        {
          abc: 'Alice',
          def: 'Alice',
          ghi: 'Bob',
          jkl: 'Bob',
          mno: 'Bob',
        }
      );
    });
  });
});
