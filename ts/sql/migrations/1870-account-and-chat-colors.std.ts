// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as z from 'zod/mini';
import type { WritableDB } from '../Interface.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';
import { sql } from '../util.std.ts';
import { type JsonValue, Uint32 } from '@signalapp/types';
import type { ChatStyle } from '../../types/ChatStyle.std.ts';
import type { AxoColor } from '../../axo/AxoColor.std.ts';

const LIGHTNESS_TABLE = {
  0: 45,
  60: 30,
  180: 30,
  240: 50,
  300: 40,
  360: 45,
} as const satisfies Record<number, number>;

type LightnessKey = keyof typeof LIGHTNESS_TABLE;

function getLightnessFromHue(
  hue: number,
  min: LightnessKey,
  max: LightnessKey
) {
  const percentage = ((hue - min) * 100) / (max - min);
  const minValue = LIGHTNESS_TABLE[min];
  const maxValue = LIGHTNESS_TABLE[max];

  return (percentage * (maxValue - minValue)) / 100 + minValue;
}

function calculateLightness(hue: number): number {
  let lightness = 45;
  if (hue < 60) {
    lightness = getLightnessFromHue(hue, 0, 60);
  } else if (hue < 180) {
    lightness = 30;
  } else if (hue < 240) {
    lightness = getLightnessFromHue(hue, 180, 240);
  } else if (hue < 300) {
    lightness = getLightnessFromHue(hue, 240, 300);
  } else {
    lightness = getLightnessFromHue(hue, 300, 360);
  }

  return lightness;
}

// Drops malformed values instead of failing the entire parent schema
function droppable<T extends z.ZodMiniType>(schema: T) {
  // `z.catch()` is not a promise
  // oxlint-disable-next-line promise/valid-params
  return z.catch(z.nullable(schema), null);
}

const OldHSLSchema = z.object({
  hue: z.number(),
  saturation: z.number(),
  lightness: z.nullish(z.number()),
});

const OldCustomColorSchema = z.object({
  start: OldHSLSchema,
  end: z.nullish(OldHSLSchema),
  deg: z.nullish(z.number()),
});

const OldCustomColorDataSchema = z.object({
  id: z.string(),
  // Only needed if the color is missing from the custom colors list
  value: droppable(OldCustomColorSchema),
});

const OldDefaultConversationColorSchema = z.object({
  color: z.string(), // presets like 'ultramarine' or 'custom'
  customColorData: droppable(OldCustomColorDataSchema),
});

const OldCustomColorsItemSchema = z.object({
  colors: droppable(z.record(z.string(), droppable(OldCustomColorSchema))),
  version: z.nullish(z.number()),
  order: droppable(z.array(z.string())),
});

const OldConversationColorAttributesSchema = z.object({
  conversationColor: z.nullish(z.string()), // presets like 'ultramarine' or 'custom'
  customColor: droppable(OldCustomColorSchema),
  customColorId: z.nullish(z.string()),
});

type OldHSL = z.infer<typeof OldHSLSchema>;
type OldCustomColor = z.infer<typeof OldCustomColorSchema>;
type OldDefaultConversationColor = z.infer<
  typeof OldDefaultConversationColorSchema
>;
type OldCustomColorsItemType = z.infer<typeof OldCustomColorsItemSchema>;
type OldConversationColorAttributes = z.infer<
  typeof OldConversationColorAttributesSchema
>;

function fromOldHsl(old: OldHSL): AxoColor.ARGBInt {
  const h = old.hue;
  const s = old.saturation / 100;
  const l = old.lightness ?? calculateLightness(old.hue) / 100;

  // convert to AARRGGBB

  const a = s * Math.min(l, 1 - l);

  function f(n: number): number {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  }

  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));

  // oxlint-disable-next-line no-bitwise
  const argbInt = ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;

  return argbInt as AxoColor.ARGBInt;
}

// Wraps degrees into the range [0, 360)
function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function fromOldCustomColor(
  old: OldCustomColor
): ChatStyle.CustomChatColor['color'] {
  if (old.end == null) {
    return { solid: fromOldHsl(old.start) };
  }
  const start = fromOldHsl(old.start);
  const end = fromOldHsl(old.end);
  // Angles are stored as whole degrees (like in backups)
  const angle = Uint32.fromNumber(normalizeDegrees(Math.round(old.deg ?? 0)));
  return { gradient: { start, end, angle } };
}

const PRESET_NAMES = new Set([
  'ultramarine',
  'crimson',
  'vermilion',
  'burlap',
  'forest',
  'wintergreen',
  'teal',
  'blue',
  'indigo',
  'violet',
  'plum',
  'taupe',
  'steel',
  'ember',
  'midnight',
  'infrared',
  'lagoon',
  'fluorescent',
  'basil',
  'sublime',
  'sea',
  'tangerine',
]);

function isPresetName(name: string): name is ChatStyle.BubbleColorPreset {
  return PRESET_NAMES.has(name);
}

function insertCustomChatColor(
  db: WritableDB,
  color: ChatStyle.CustomChatColor['color']
): ChatStyle.CustomChatColorId {
  const [query, params] = sql`
    INSERT INTO customChatColors
      (solid, gradientStart, gradientEnd, gradientAngle)
    VALUES (
      ${color.solid ?? null},
      ${color.gradient?.start ?? null},
      ${color.gradient?.end ?? null},
      ${color.gradient?.angle ?? null}
    )
    RETURNING id
  `;
  const row = db.prepare(query).get<{ id: number }>(params);
  if (row == null) {
    throw new Error('insertCustomChatColor: Failed to insert');
  }
  return row.id as ChatStyle.CustomChatColorId;
}

/**
 * Track the migration from UUID to the new autoincrementing integers while
 * filling in any missing custom colors with the copy on conversations
 */
class CustomChatColorMigrator {
  readonly #db: WritableDB;
  readonly #idsByOldId = new Map<string, ChatStyle.CustomChatColorId>();

  constructor(db: WritableDB) {
    this.#db = db;
  }

  insert(oldId: string, old: OldCustomColor): void {
    if (this.#idsByOldId.has(oldId)) {
      return;
    }
    const id = insertCustomChatColor(this.#db, fromOldCustomColor(old));
    this.#idsByOldId.set(oldId, id);
  }

  /**
   * Prefers the color from the custom colors from "items", but if it doesn't
   * exist, insert it from the copy on the conversation so the conversation
   * doesn't just drop its color.
   */
  getOrInsert(
    oldId: string,
    copy: OldCustomColor | null
  ): ChatStyle.CustomChatColorId | null {
    if (copy != null) {
      this.insert(oldId, copy);
    }
    return this.#idsByOldId.get(oldId) ?? null;
  }
}

function fromOldDefaultConversationColor(
  old: OldDefaultConversationColor,
  migrator: CustomChatColorMigrator
): ChatStyle['bubbleColor'] | null {
  if (isPresetName(old.color)) {
    return { bubbleColorPreset: old.color };
  }
  if (old.color !== 'custom' || old.customColorData == null) {
    // previously if you did not have "custom" set it would not render the
    // customColorData, so we want to drop it instead of suddenly starting to
    // show it
    return null;
  }
  const { id, value } = old.customColorData;
  const customChatColorId = migrator.getOrInsert(id, value);
  if (customChatColorId == null) {
    return null;
  }
  return { customChatColorId };
}

function fromOldCustomColorsItemType(
  old: OldCustomColorsItemType,
  migrator: CustomChatColorMigrator
): void {
  const oldColors = old.colors ?? {};

  for (const id of old.order ?? []) {
    const entry = oldColors[id];
    if (entry != null) {
      migrator.insert(id, entry);
    }
  }

  for (const [id, entry] of Object.entries(oldColors)) {
    if (entry != null) {
      migrator.insert(id, entry);
    }
  }
}

function fromOldConversationColorAttributes(
  old: OldConversationColorAttributes,
  migrator: CustomChatColorMigrator
): ChatStyle['bubbleColor'] | null {
  if (old.conversationColor != null && isPresetName(old.conversationColor)) {
    return { bubbleColorPreset: old.conversationColor };
  }
  if (old.conversationColor !== 'custom' || old.customColorId == null) {
    return null;
  }
  const customChatColorId = migrator.getOrInsert(
    old.customColorId,
    old.customColor
  );
  if (customChatColorId == null) {
    return null;
  }
  return { customChatColorId };
}

function getItemById(db: WritableDB, id: string): JsonValue | null {
  const [query, params] = sql`
    SELECT json FROM items
    WHERE id IS ${id}
  `;
  const row = db.prepare(query).get<{ json: string }>(params);
  if (row == null) {
    return null;
  }
  return JSON.parse(row.json).value as JsonValue;
}

function deleteItemById(db: WritableDB, id: string): void {
  const [query, params] = sql`
    DELETE FROM items
    WHERE id IS ${id}
  `;
  db.prepare(query).run(params);
}

function createTables(db: WritableDB): void {
  const [query] = sql`
    CREATE TABLE customChatColors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solid INTEGER,
      gradientStart INTEGER,
      gradientEnd INTEGER,
      gradientAngle INTEGER
    ) STRICT;

    -- Always has exactly one row for our account
    -- It's intended to mirror AccountData/AccountSettings in Backups.proto
    --
    -- In the future we can migrate more things from "items" table and from the
    -- isMe conversation
    CREATE TABLE account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      defaultBubbleColorPreset TEXT,
      defaultCustomChatColorId INTEGER
        REFERENCES customChatColors(id) ON DELETE SET NULL
    ) STRICT;

    INSERT INTO account (id) VALUES (1);

    ALTER TABLE conversations
      ADD COLUMN bubbleColorPreset TEXT;

    ALTER TABLE conversations
      ADD COLUMN customChatColorId INTEGER
        REFERENCES customChatColors(id) ON DELETE SET NULL;

    CREATE INDEX conversations_customChatColorId
      ON conversations (customChatColorId);
  `;
  db.exec(query);
}

function updateCustomColors(
  db: WritableDB,
  logger: LoggerType,
  migrator: CustomChatColorMigrator
) {
  const oldId = 'customColors';

  const old = getItemById(db, oldId);
  if (old == null) {
    return;
  }

  const result = OldCustomColorsItemSchema.safeParse(old);
  if (result.success) {
    fromOldCustomColorsItemType(result.data, migrator);
  } else {
    logger.warn(`failed to parse ${oldId}`, result.error);
  }

  deleteItemById(db, oldId);
}

function updateDefaultConversationColor(
  db: WritableDB,
  logger: LoggerType,
  migrator: CustomChatColorMigrator
) {
  const oldId = 'defaultConversationColor';

  const old = getItemById(db, oldId);
  if (old == null) {
    return;
  }

  const result = OldDefaultConversationColorSchema.safeParse(old);
  if (!result.success) {
    logger.warn(`failed to parse ${oldId}`, result.error);
  }

  const updated = result.success
    ? fromOldDefaultConversationColor(result.data, migrator)
    : null;

  deleteItemById(db, oldId);

  // Drop if can't be updated
  if (updated != null) {
    const [query, params] = sql`
      UPDATE account
      SET
        defaultBubbleColorPreset = ${updated.bubbleColorPreset ?? null},
        defaultCustomChatColorId = ${updated.customChatColorId ?? null}
      WHERE id = 1
    `;
    db.prepare(query).run(params);
  }
}

function updateAllConversations(
  db: WritableDB,
  logger: LoggerType,
  migrator: CustomChatColorMigrator
) {
  const [selectQuery] = sql`
    SELECT id, json
    FROM conversations
    WHERE
      json ->> 'conversationColor' IS NOT NULL OR
      json ->> 'customColorId' IS NOT NULL OR
      json ->> 'customColor' IS NOT NULL
  `;

  const [updateQuery] = sql`
    UPDATE conversations
    SET
      json = JSON_PATCH(json, $patch),
      bubbleColorPreset = $bubbleColorPreset,
      customChatColorId = $customChatColorId
    WHERE id IS $id
  `;

  const rows = db.prepare(selectQuery).all<{ id: string; json: string }>();

  const preparedUpdate = db.prepare(updateQuery);
  for (const row of rows) {
    const result = OldConversationColorAttributesSchema.safeParse(
      JSON.parse(row.json)
    );
    if (!result.success) {
      logger.warn(`failed to parse conversation ${row.id}`, result.error);
    }

    const updated = result.success
      ? fromOldConversationColorAttributes(result.data, migrator)
      : null;

    const bubbleColorPreset = updated?.bubbleColorPreset ?? null;
    const customChatColorId = updated?.customChatColorId ?? null;

    // Bubble colors are stored in their own columns now
    const patch = JSON.stringify({
      // delete
      conversationColor: null,
      customColor: null,
      customColorId: null,
    });

    preparedUpdate.run({
      id: row.id,
      patch,
      bubbleColorPreset,
      customChatColorId,
    });
  }
}

export default function updateToSchemaVersion1870(
  db: WritableDB,
  logger: LoggerType
): void {
  createTables(db);

  const migrator = new CustomChatColorMigrator(db);

  // The custom colors list needs to be migrated first so that it keeps its
  // order and so the default and conversations can reference it
  updateCustomColors(db, logger, migrator);
  updateDefaultConversationColor(db, logger, migrator);
  updateAllConversations(db, logger, migrator);
}
