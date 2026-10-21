// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { cwd } from 'node:process';

import type { AxoColor } from '../../../axo/AxoColor.std.ts';
import type { ConversationAttributesType } from '../../../model-types.std.ts';
import type { WritableDB } from '../../../sql/Interface.std.ts';
import {
  DataReader,
  DataWriter,
  setupTests,
} from '../../../sql/Server.node.ts';
import { sql } from '../../../sql/util.std.ts';
import { createDB } from '../helpers.node.ts';
import { Uint32 } from '@signalapp/types';

const RED = { solid: 0xffff0000 as AxoColor.ARGBInt };
const BLUE = { solid: 0xff0000ff as AxoColor.ARGBInt };
const RED_TO_BLUE = {
  gradient: {
    start: 0xffff0000 as AxoColor.ARGBInt,
    end: 0xff0000ff as AxoColor.ARGBInt,
    angle: Uint32.fromNumber(45),
  },
};

function getConversation(
  id: string,
  overrides: Partial<ConversationAttributesType> = {}
): ConversationAttributesType {
  return {
    id,
    type: 'private',
    version: 0,
    expireTimerVersion: 1,
    ...overrides,
  };
}

describe('sql/server/customChatColors', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    setupTests(db, { userDataPath: cwd() });
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  function getBubbleColorColumns(conversationId: string): unknown {
    const [query, params] = sql`
      SELECT bubbleColorPreset, customChatColorId
      FROM conversations
      WHERE id = ${conversationId}
    `;
    return db.prepare(query).get(params);
  }

  function getJson(conversationId: string): Record<string, unknown> {
    const [query, params] = sql`
      SELECT json FROM conversations WHERE id = ${conversationId}
    `;
    const json = db.prepare(query, { pluck: true }).get<string>(params);
    assert(json != null);
    return JSON.parse(json);
  }

  describe('custom chat colors', () => {
    it('creates, updates, and deletes colors in order', () => {
      const red = DataWriter.createCustomChatColor(db, RED);
      const [blue, gradient] = DataWriter.createCustomChatColors(db, [
        BLUE,
        RED_TO_BLUE,
      ]);
      assert(blue != null && gradient != null);

      assert.deepEqual(DataReader.getAllCustomChatColors(db), [
        red,
        blue,
        gradient,
      ]);

      DataWriter.updateCustomChatColor(db, { id: red.id, color: RED_TO_BLUE });
      DataWriter.deleteCustomChatColor(db, blue.id);

      assert.deepEqual(DataReader.getAllCustomChatColors(db), [
        { id: red.id, color: RED_TO_BLUE },
        gradient,
      ]);
    });

    it('rejects fractional gradient angles', () => {
      assert.throws(() => {
        DataWriter.createCustomChatColor(db, {
          // Bypasses the type to check that the database rejects it too
          gradient: { ...RED_TO_BLUE.gradient, angle: 45.5 as Uint32 },
        });
      }, /cannot store REAL value in INTEGER column/);
    });

    it('never reuses ids of deleted colors', () => {
      DataWriter.createCustomChatColor(db, RED);
      const second = DataWriter.createCustomChatColor(db, BLUE);
      DataWriter.deleteCustomChatColor(db, second.id);

      const third = DataWriter.createCustomChatColor(db, BLUE);
      assert.notEqual(third.id, second.id);
      assert(third.id > second.id);
    });

    it('skips invalid rows', () => {
      db.prepare(
        'INSERT INTO customChatColors (gradientStart) VALUES (1)'
      ).run();
      const red = DataWriter.createCustomChatColor(db, RED);

      assert.deepEqual(DataReader.getAllCustomChatColors(db), [red]);
    });
  });

  describe('conversations', () => {
    const NO_COLUMNS = { bubbleColorPreset: null, customChatColorId: null };

    it('stores bubble colors in their own columns', () => {
      const red = DataWriter.createCustomChatColor(db, RED);
      DataWriter.saveConversation(
        db,
        getConversation('c1', { customChatColorId: red.id })
      );

      assert.deepEqual(getBubbleColorColumns('c1'), {
        bubbleColorPreset: null,
        customChatColorId: red.id,
      });
      assert.equal(getJson('c1').customChatColorId, undefined);
      assert.equal(
        DataReader.getConversationById(db, 'c1')?.customChatColorId,
        red.id
      );
      assert.equal(
        DataReader.getAllConversations(db).at(0)?.customChatColorId,
        red.id
      );

      DataWriter.updateConversation(
        db,
        getConversation('c1', { bubbleColorPreset: 'crimson' })
      );

      assert.deepEqual(getBubbleColorColumns('c1'), {
        bubbleColorPreset: 'crimson',
        customChatColorId: null,
      });
      assert.equal(getJson('c1').bubbleColorPreset, undefined);
      const conversation = DataReader.getConversationById(db, 'c1');
      assert.equal(conversation?.bubbleColorPreset, 'crimson');
      assert.equal(conversation?.customChatColorId, undefined);
    });

    it('ignores unknown presets', () => {
      DataWriter.saveConversation(db, getConversation('c1'));
      db.prepare(
        "UPDATE conversations SET bubbleColorPreset = 'unknown'"
      ).run();

      assert.equal(
        DataReader.getConversationById(db, 'c1')?.bubbleColorPreset,
        undefined
      );
    });

    it('writes deleted colors as NULL instead of throwing', () => {
      const red = DataWriter.createCustomChatColor(db, RED);
      DataWriter.deleteCustomChatColor(db, red.id);

      DataWriter.saveConversation(
        db,
        getConversation('c1', { customChatColorId: red.id })
      );
      assert.deepEqual(getBubbleColorColumns('c1'), NO_COLUMNS);

      DataWriter.updateConversation(
        db,
        getConversation('c1', { customChatColorId: red.id })
      );
      assert.deepEqual(getBubbleColorColumns('c1'), NO_COLUMNS);
    });

    it('does not fail other conversations in a batch', () => {
      const red = DataWriter.createCustomChatColor(db, RED);
      DataWriter.deleteCustomChatColor(db, red.id);
      DataWriter.saveConversations(db, [
        getConversation('c1'),
        getConversation('c2'),
      ]);

      DataWriter.updateConversations(db, [
        getConversation('c1', { customChatColorId: red.id }),
        getConversation('c2', { bubbleColorPreset: 'crimson' }),
      ]);

      assert.deepEqual(getBubbleColorColumns('c1'), NO_COLUMNS);
      assert.deepEqual(getBubbleColorColumns('c2'), {
        bubbleColorPreset: 'crimson',
        customChatColorId: null,
      });
    });

    it('resets conversations when a color is deleted', () => {
      const red = DataWriter.createCustomChatColor(db, RED);
      DataWriter.saveConversation(
        db,
        getConversation('c1', { customChatColorId: red.id })
      );

      DataWriter.deleteCustomChatColor(db, red.id);
      assert.deepEqual(getBubbleColorColumns('c1'), NO_COLUMNS);
      assert.equal(
        DataReader.getConversationById(db, 'c1')?.customChatColorId,
        undefined
      );
    });

    it('resets all colors with removeAllConversationColors', () => {
      const red = DataWriter.createCustomChatColor(db, RED);
      DataWriter.saveConversations(db, [
        getConversation('c1', { bubbleColorPreset: 'crimson' }),
        getConversation('c2', { customChatColorId: red.id }),
      ]);

      DataWriter.removeAllConversationColors(db);

      assert.deepEqual(getBubbleColorColumns('c1'), NO_COLUMNS);
      assert.deepEqual(getBubbleColorColumns('c2'), NO_COLUMNS);
    });
  });

  describe('account', () => {
    it('defaults to null', () => {
      assert.deepEqual(DataReader.getAccount(db), {
        defaultBubbleColor: null,
      });
    });

    it('updates the default bubble color', () => {
      DataWriter.updateAccountDefaultBubbleColor(db, {
        bubbleColorPreset: 'crimson',
      });
      assert.deepEqual(DataReader.getAccount(db), {
        defaultBubbleColor: { bubbleColorPreset: 'crimson' },
      });

      const red = DataWriter.createCustomChatColor(db, RED);
      DataWriter.updateAccountDefaultBubbleColor(db, {
        customChatColorId: red.id,
      });
      assert.deepEqual(DataReader.getAccount(db), {
        defaultBubbleColor: { customChatColorId: red.id },
      });

      DataWriter.updateAccountDefaultBubbleColor(db, null);
      assert.deepEqual(DataReader.getAccount(db), {
        defaultBubbleColor: null,
      });
    });

    it('resets the default bubble color when its color is deleted', () => {
      const red = DataWriter.createCustomChatColor(db, RED);
      DataWriter.updateAccountDefaultBubbleColor(db, {
        customChatColorId: red.id,
      });

      DataWriter.deleteCustomChatColor(db, red.id);
      assert.deepEqual(DataReader.getAccount(db), {
        defaultBubbleColor: null,
      });

      // Setting a deleted color fails the foreign key constraint
      assert.throws(() => {
        DataWriter.updateAccountDefaultBubbleColor(db, {
          customChatColorId: red.id,
        });
      }, /FOREIGN KEY constraint failed/);
      assert.deepEqual(DataReader.getAccount(db), {
        defaultBubbleColor: null,
      });
    });

    it('prefers the custom color when both columns are set', () => {
      const red = DataWriter.createCustomChatColor(db, RED);
      const [query, params] = sql`
        UPDATE account
        SET
          defaultBubbleColorPreset = 'crimson',
          defaultCustomChatColorId = ${red.id}
        WHERE id = 1
      `;
      db.prepare(query).run(params);

      assert.deepEqual(DataReader.getAccount(db), {
        defaultBubbleColor: { customChatColorId: red.id },
      });
    });

    it('resets the account row with removeAll', () => {
      DataWriter.updateAccountDefaultBubbleColor(db, {
        bubbleColorPreset: 'crimson',
      });

      DataWriter.removeAll(db);

      assert.deepEqual(DataReader.getAccount(db), {
        defaultBubbleColor: null,
      });
    });

    it('asserts that the account row exists', () => {
      db.prepare('DELETE FROM account').run();

      assert.throws(() => DataReader.getAccount(db), /Missing account row/);
      assert.throws(() => {
        DataWriter.updateAccountDefaultBubbleColor(db, null);
      }, /Missing account row/);
    });
  });
});
