// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface.std.ts';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.ts';

const COLOR_ID_1 = '6b2d8c1e-4f3a-4b5c-9d7e-1a2b3c4d5e6f';
const COLOR_ID_2 = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const COLOR_ID_3 = '3c1f5a2e-8d4b-4e6f-a1c2-7b9d0e3f5a6c';

const RED = 0xffff0000;
const BLUE = 0xff0000ff;
// hue 120 with no stored lightness → calculated lightness of 30%
const GREEN_DEFAULT_LIGHTNESS = 0xff009900;

const OLD_RED = { start: { hue: 0, saturation: 100, lightness: 0.5 } };
const OLD_BLUE = { start: { hue: 240, saturation: 100, lightness: 0.5 } };
const OLD_RED_TO_BLUE = {
  start: { hue: 0, saturation: 100, lightness: 0.5 },
  end: { hue: 240, saturation: 100, lightness: 0.5 },
};

describe('SQL/updateToSchemaVersion1870', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1860);
  });

  afterEach(() => {
    db.close();
  });

  function getItems() {
    return Object.fromEntries(
      getTableData(db, 'items').map(row => [row.id, row.json])
    );
  }

  function getCustomChatColors() {
    return getTableData(db, 'customChatColors');
  }

  function getAccount() {
    return getTableData(db, 'account');
  }

  function getConversations() {
    return Object.fromEntries(
      getTableData(db, 'conversations').map(row => {
        const { json, bubbleColorPreset, customChatColorId } = row;
        return [
          row.id,
          // `getTableData` omits NULL columns
          { json, bubbleColorPreset, customChatColorId },
        ];
      })
    );
  }

  function insertConversation(json: Record<string, unknown>) {
    insertData(db, 'conversations', [
      {
        id: json.id as string,
        type: 'private',
        expireTimerVersion: 1,
        json,
      },
    ]);
  }

  it('migrates customColors and defaultConversationColor items', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: {
          id: 'customColors',
          value: {
            version: 1,
            order: [COLOR_ID_2],
            colors: {
              [COLOR_ID_1]: OLD_RED,
              [COLOR_ID_2]: { ...OLD_RED_TO_BLUE, deg: 90 },
              'not-a-uuid': OLD_RED,
            },
          },
        },
      },
      {
        id: 'defaultConversationColor',
        json: {
          id: 'defaultConversationColor',
          value: {
            color: 'custom',
            customColorData: {
              id: COLOR_ID_1,
              // Stale copy, the color from the list should be used instead
              value: { start: { hue: 120, saturation: 100 } },
            },
          },
        },
      },
    ]);

    updateToVersion(db, 1870);

    const items = getItems();
    assert.isUndefined(items.customColors);
    assert.isUndefined(items.defaultConversationColor);
    assert.isUndefined(items.customChatColors);
    assert.isUndefined(items.defaultBubbleColor);

    assert.deepStrictEqual(getCustomChatColors(), [
      { id: 1, gradientStart: RED, gradientEnd: BLUE, gradientAngle: 90 },
      { id: 2, solid: RED },
      { id: 3, solid: RED },
    ]);
    assert.deepStrictEqual(getAccount(), [
      { id: 1, defaultCustomChatColorId: 2 },
    ]);
  });

  it('rounds gradient angles to whole degrees', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: {
          id: 'customColors',
          value: {
            version: 1,
            order: [COLOR_ID_1, COLOR_ID_2, COLOR_ID_3],
            colors: {
              [COLOR_ID_1]: { ...OLD_RED_TO_BLUE, deg: 45.4 },
              [COLOR_ID_2]: { ...OLD_RED_TO_BLUE, deg: 359.6 },
              [COLOR_ID_3]: { ...OLD_RED_TO_BLUE, deg: -10 },
            },
          },
        },
      },
    ]);

    updateToVersion(db, 1870);

    assert.deepStrictEqual(
      getCustomChatColors().map(row => row.gradientAngle),
      [45, 0, 350]
    );
  });

  it('migrates a preset defaultConversationColor', () => {
    insertData(db, 'items', [
      {
        id: 'defaultConversationColor',
        json: {
          id: 'defaultConversationColor',
          value: { color: 'crimson' },
        },
      },
    ]);

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getAccount(), [
      { id: 1, defaultBubbleColorPreset: 'crimson' },
    ]);
  });

  it('appends a defaultConversationColor missing from the list', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: {
          id: 'customColors',
          value: { version: 1, colors: { [COLOR_ID_1]: OLD_RED } },
        },
      },
      {
        id: 'defaultConversationColor',
        json: {
          id: 'defaultConversationColor',
          value: {
            color: 'custom',
            customColorData: {
              id: COLOR_ID_2,
              value: { start: { hue: 120, saturation: 100 } },
            },
          },
        },
      },
    ]);

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getCustomChatColors(), [
      { id: 1, solid: RED },
      { id: 2, solid: GREEN_DEFAULT_LIGHTNESS },
    ]);
    assert.deepStrictEqual(getAccount(), [
      { id: 1, defaultCustomChatColorId: 2 },
    ]);
  });

  it('skips malformed customColors entries', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: {
          id: 'customColors',
          value: {
            version: 1,
            colors: {
              [COLOR_ID_1]: null,
              [COLOR_ID_3]: { start: 'red' },
              [COLOR_ID_2]: OLD_RED,
            },
          },
        },
      },
      {
        id: 'defaultConversationColor',
        json: {
          id: 'defaultConversationColor',
          value: {
            color: 'custom',
            customColorData: { id: COLOR_ID_1, value: null },
          },
        },
      },
    ]);

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getCustomChatColors(), [{ id: 1, solid: RED }]);
    assert.deepStrictEqual(getAccount(), [{ id: 1 }]);
  });

  it('handles customColors without colors', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: { id: 'customColors', value: { version: 1 } },
      },
    ]);

    updateToVersion(db, 1870);

    assert.isUndefined(getItems().customColors);
    assert.deepStrictEqual(getCustomChatColors(), []);
  });

  it('ignores custom color data when color is not custom', () => {
    insertData(db, 'items', [
      {
        id: 'defaultConversationColor',
        json: {
          id: 'defaultConversationColor',
          value: {
            color: 'not-a-preset',
            customColorData: { id: COLOR_ID_1, value: OLD_RED },
          },
        },
      },
    ]);
    insertConversation({
      id: 'stale',
      customColorId: COLOR_ID_1,
      customColor: OLD_RED,
    });

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getAccount(), [{ id: 1 }]);
    assert.deepStrictEqual(getCustomChatColors(), []);
    assert.deepStrictEqual(getConversations(), {
      stale: {
        json: { id: 'stale' },
        bubbleColorPreset: undefined,
        customChatColorId: undefined,
      },
    });
  });

  it('migrates conversation colors', () => {
    insertConversation({ id: 'preset', conversationColor: 'crimson' });
    insertConversation({
      id: 'presetWithMalformedCustom',
      conversationColor: 'crimson',
      customColorId: COLOR_ID_1,
      customColor: { start: 'red' },
    });
    insertConversation({
      id: 'custom',
      conversationColor: 'custom',
      customColorId: COLOR_ID_1,
      customColor: OLD_RED_TO_BLUE,
    });
    insertConversation({
      id: 'notUuid',
      conversationColor: 'custom',
      customColorId: 'not-a-uuid',
      customColor: OLD_BLUE,
    });
    insertConversation({
      id: 'malformed',
      conversationColor: 'custom',
      customColorId: COLOR_ID_2,
      customColor: { start: 'red' },
    });
    insertConversation({ id: 'none' });

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getCustomChatColors(), [
      { id: 1, gradientStart: RED, gradientEnd: BLUE, gradientAngle: 0 },
      { id: 2, solid: BLUE },
    ]);
    assert.deepStrictEqual(getConversations(), {
      preset: {
        json: { id: 'preset' },
        bubbleColorPreset: 'crimson',
        customChatColorId: undefined,
      },
      presetWithMalformedCustom: {
        json: {
          id: 'presetWithMalformedCustom',
        },
        bubbleColorPreset: 'crimson',
        customChatColorId: undefined,
      },
      custom: {
        json: { id: 'custom' },
        bubbleColorPreset: undefined,
        customChatColorId: 1,
      },
      notUuid: {
        json: { id: 'notUuid' },
        bubbleColorPreset: undefined,
        customChatColorId: 2,
      },
      malformed: {
        json: { id: 'malformed' },
        bubbleColorPreset: undefined,
        customChatColorId: undefined,
      },
      none: {
        json: { id: 'none' },
        bubbleColorPreset: undefined,
        customChatColorId: undefined,
      },
    });
  });

  it('uses the list color when the copy is malformed', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: {
          id: 'customColors',
          value: { version: 1, colors: { [COLOR_ID_1]: OLD_RED } },
        },
      },
      {
        id: 'defaultConversationColor',
        json: {
          id: 'defaultConversationColor',
          value: {
            color: 'custom',
            customColorData: { id: COLOR_ID_1, value: { start: 'red' } },
          },
        },
      },
    ]);
    insertConversation({
      id: 'malformedCopy',
      conversationColor: 'custom',
      customColorId: COLOR_ID_1,
      customColor: { start: 'red' },
    });
    insertConversation({
      id: 'missingCopy',
      conversationColor: 'custom',
      customColorId: COLOR_ID_1,
    });

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getCustomChatColors(), [{ id: 1, solid: RED }]);
    assert.deepStrictEqual(getAccount(), [
      { id: 1, defaultCustomChatColorId: 1 },
    ]);
    assert.deepStrictEqual(getConversations(), {
      malformedCopy: {
        json: { id: 'malformedCopy' },
        bubbleColorPreset: undefined,
        customChatColorId: 1,
      },
      missingCopy: {
        json: { id: 'missingCopy' },
        bubbleColorPreset: undefined,
        customChatColorId: 1,
      },
    });
  });

  it('removes leftover customColor keys', () => {
    insertConversation({ id: 'leftover', customColor: OLD_RED });

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getConversations(), {
      leftover: {
        json: { id: 'leftover' },
        bubbleColorPreset: undefined,
        customChatColorId: undefined,
      },
    });
  });

  it('prefers the list color over stale conversation copies', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: {
          id: 'customColors',
          value: { version: 1, colors: { [COLOR_ID_1]: OLD_RED } },
        },
      },
    ]);
    insertConversation({
      id: 'stale',
      conversationColor: 'custom',
      customColorId: COLOR_ID_1,
      customColor: OLD_BLUE,
    });

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getCustomChatColors(), [{ id: 1, solid: RED }]);
    assert.deepStrictEqual(getConversations(), {
      stale: {
        json: { id: 'stale' },
        bubbleColorPreset: undefined,
        customChatColorId: 1,
      },
    });
  });

  it('appends conversation colors missing from the list once', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: {
          id: 'customColors',
          value: { version: 1, colors: { [COLOR_ID_1]: OLD_RED } },
        },
      },
    ]);
    insertConversation({
      id: 'a',
      conversationColor: 'custom',
      customColorId: COLOR_ID_3,
      customColor: OLD_BLUE,
    });
    insertConversation({
      id: 'b',
      conversationColor: 'custom',
      customColorId: COLOR_ID_3,
      customColor: OLD_BLUE,
    });

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getCustomChatColors(), [
      { id: 1, solid: RED },
      { id: 2, solid: BLUE },
    ]);
    assert.deepStrictEqual(getConversations(), {
      a: {
        json: { id: 'a' },
        bubbleColorPreset: undefined,
        customChatColorId: 2,
      },
      b: {
        json: { id: 'b' },
        bubbleColorPreset: undefined,
        customChatColorId: 2,
      },
    });
  });

  it('resets references when a custom color is deleted', () => {
    insertData(db, 'items', [
      {
        id: 'customColors',
        json: {
          id: 'customColors',
          value: { version: 1, colors: { [COLOR_ID_1]: OLD_RED } },
        },
      },
      {
        id: 'defaultConversationColor',
        json: {
          id: 'defaultConversationColor',
          value: {
            color: 'custom',
            customColorData: { id: COLOR_ID_1, value: OLD_RED },
          },
        },
      },
    ]);
    insertConversation({
      id: 'custom',
      conversationColor: 'custom',
      customColorId: COLOR_ID_1,
      customColor: OLD_RED,
    });

    updateToVersion(db, 1870);

    assert.deepStrictEqual(getAccount(), [
      { id: 1, defaultCustomChatColorId: 1 },
    ]);
    assert.strictEqual(getConversations().custom?.customChatColorId, 1);

    db.pragma('foreign_keys = ON');
    db.prepare('DELETE FROM customChatColors WHERE id = 1').run();

    assert.deepStrictEqual(getAccount(), [{ id: 1 }]);
    assert.isUndefined(getConversations().custom?.customChatColorId);
  });
});
