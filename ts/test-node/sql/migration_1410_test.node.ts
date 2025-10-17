// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { type WritableDB } from '../../sql/Interface.std.js';
import {
  createDB,
  updateToVersion,
  insertData,
  getTableData,
} from './helpers.node.js';
import { createOrUpdate, getById } from '../../sql/util.std.js';

describe('SQL/updateToSchemaVersion1410', () => {
  let db: WritableDB;

  afterEach(() => {
    db.close();
  });

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1400);
  });

  it('deletes conversation wallpaper data if exists', () => {
    const convos = [
      {
        id: 'convo-1',
        expireTimerVersion: 1,
        json: {
          wallpaperPreset: 42,
          wallpaperPhotoPointerBase64: 'base64',
          dimWallpaperInDarkMode: false,
          autoBubbleColor: true,
          profileName: 'Alice',
        },
      },
      {
        id: 'convo-2',
        expireTimerVersion: 3,
        json: {
          wallpaperPreset: 42,
          wallpaperPhotoPointerBase64: 'base64',
          profileName: 'Bob',
        },
      },
      {
        id: 'convo-3',
        expireTimerVersion: 4,
        json: {
          profileName: 'Charlie',
        },
      },
    ];
    insertData(db, 'conversations', convos);
    updateToVersion(db, 1410);

    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: 'convo-1',
        expireTimerVersion: 1,
        json: {
          profileName: 'Alice',
        },
      },
      {
        id: 'convo-2',
        expireTimerVersion: 3,
        json: {
          profileName: 'Bob',
        },
      },
      {
        id: 'convo-3',
        expireTimerVersion: 4,
        json: {
          profileName: 'Charlie',
        },
      },
    ]);
  });

  it('deletes default wallpaper data if exists', () => {
    const items = [
      {
        id: 'defaultWallpaperPhotoPointer',
        value: JSON.stringify(new Uint8Array([1, 2, 3])),
      },
      {
        id: 'defaultWallpaperPreset',
        value: 12,
      },
      {
        id: 'defaultDimWallpaperInDarkMode',
        value: true,
      },
      {
        id: 'defaultAutoBubbleColor',
        value: false,
      },
      {
        id: 'otherItem',
        value: 'otherItem-shouldBePreserved',
      },
    ];

    for (const item of items) {
      createOrUpdate(db, 'items', { id: item.id, value: item });
    }
    updateToVersion(db, 1410);

    assert.deepStrictEqual(
      getById(db, 'items', 'defaultWallpaperPhotoPointer'),
      undefined
    );
    assert.deepStrictEqual(getById(db, 'items', 'otherItem'), {
      id: 'otherItem',
      value: {
        id: 'otherItem',
        value: 'otherItem-shouldBePreserved',
      },
    });
    assert.deepStrictEqual(getTableData(db, 'items'), [
      {
        id: 'otherItem',
        json: {
          id: 'otherItem',
          value: {
            id: 'otherItem',
            value: 'otherItem-shouldBePreserved',
          },
        },
      },
    ]);
  });
});
