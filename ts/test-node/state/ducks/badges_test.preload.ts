// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getFakeBadge } from '../../../test-helpers/getFakeBadge.std.js';
import { repeat, zipObject } from '../../../util/iterables.std.js';
import { BadgeImageTheme } from '../../../badges/BadgeImageTheme.std.js';

import type { BadgesStateType } from '../../../state/ducks/badges.preload.js';
import { actions, reducer } from '../../../state/ducks/badges.preload.js';

describe('both/state/ducks/badges', () => {
  describe('badgeImageFileDownloaded', () => {
    const { badgeImageFileDownloaded } = actions;

    it("does nothing if the URL isn't in the list of badges", () => {
      const state: BadgesStateType = {
        byId: { foo: getFakeBadge({ id: 'foo' }) },
      };
      const action = badgeImageFileDownloaded(
        'https://foo.example.com/image.svg',
        '/path/to/file.svg'
      );
      const result = reducer(state, action);

      assert.deepStrictEqual(result, state);
    });

    it('updates all badge image files with matching URLs', () => {
      const state: BadgesStateType = {
        byId: {
          badge1: {
            ...getFakeBadge({ id: 'badge1' }),
            images: [
              ...Array(3).fill(
                zipObject(
                  Object.values(BadgeImageTheme),
                  repeat({ url: 'https://example.com/a.svg' })
                )
              ),
              {
                [BadgeImageTheme.Transparent]: {
                  url: 'https://example.com/b.svg',
                },
              },
            ],
          },
          badge2: getFakeBadge({ id: 'badge2' }),
          badge3: {
            ...getFakeBadge({ id: 'badge3' }),
            images: Array(4).fill({
              [BadgeImageTheme.Dark]: {
                localPath: 'to be overridden',
                url: 'https://example.com/a.svg',
              },
              [BadgeImageTheme.Light]: {
                localPath: 'to be overridden',
                url: 'https://example.com/a.svg',
              },
              [BadgeImageTheme.Transparent]: {
                localPath: '/path/should/be/unchanged',
                url: 'https://example.com/b.svg',
              },
            }),
          },
        },
      };
      const action = badgeImageFileDownloaded(
        'https://example.com/a.svg',
        '/path/to/file.svg'
      );
      const result = reducer(state, action);

      assert.deepStrictEqual(result.byId.badge1?.images, [
        ...Array(3).fill(
          zipObject(
            Object.values(BadgeImageTheme),
            repeat({
              localPath: '/path/to/file.svg',
              url: 'https://example.com/a.svg',
            })
          )
        ),
        {
          [BadgeImageTheme.Transparent]: {
            url: 'https://example.com/b.svg',
          },
        },
      ]);
      assert.deepStrictEqual(
        result.byId.badge2,
        getFakeBadge({ id: 'badge2' })
      );
      assert.deepStrictEqual(
        result.byId.badge3?.images,
        Array(4).fill({
          [BadgeImageTheme.Dark]: {
            localPath: '/path/to/file.svg',
            url: 'https://example.com/a.svg',
          },
          [BadgeImageTheme.Light]: {
            localPath: '/path/to/file.svg',
            url: 'https://example.com/a.svg',
          },
          [BadgeImageTheme.Transparent]: {
            localPath: '/path/should/be/unchanged',
            url: 'https://example.com/b.svg',
          },
        })
      );
    });
  });
});
