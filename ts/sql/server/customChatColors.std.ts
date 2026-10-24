// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AxoColor } from '../../axo/AxoColor.std.ts';
import { Uint32 } from '@signalapp/types';
import { createLogger } from '../../logging/log.std.ts';
import type { ChatStyle } from '../../types/ChatStyle.std.ts';
import type { ReadableDB, WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';

const log = createLogger('customChatColors');

type CustomChatColorRow = Readonly<{
  id: number;
  solid: number | null;
  gradientStart: number | null;
  gradientEnd: number | null;
  gradientAngle: number | null;
}>;

function rowToCustomChatColor(
  row: CustomChatColorRow
): ChatStyle.CustomChatColor | null {
  const id = row.id as ChatStyle.CustomChatColorId;

  if (row.solid != null) {
    return { id, color: { solid: row.solid as AxoColor.ARGBInt } };
  }

  if (
    row.gradientStart != null &&
    row.gradientEnd != null &&
    row.gradientAngle != null &&
    Uint32.isValid(row.gradientAngle)
  ) {
    const gradient: ChatStyle.Gradient = {
      start: row.gradientStart as AxoColor.ARGBInt,
      end: row.gradientEnd as AxoColor.ARGBInt,
      angle: row.gradientAngle,
    };
    return { id, color: { gradient } };
  }

  return null;
}

function colorToParams(
  color: ChatStyle.CustomChatColor['color']
): Omit<CustomChatColorRow, 'id'> {
  return {
    solid: color.solid ?? null,
    gradientStart: color.gradient?.start ?? null,
    gradientEnd: color.gradient?.end ?? null,
    gradientAngle: color.gradient?.angle ?? null,
  };
}

export function getAllCustomChatColors(
  db: ReadableDB
): ReadonlyArray<ChatStyle.CustomChatColor> {
  const [query, params] = sql`
    SELECT * FROM customChatColors
    ORDER BY id ASC
  `;
  const rows = db.prepare(query).all<CustomChatColorRow>(params);

  const result: Array<ChatStyle.CustomChatColor> = [];
  for (const row of rows) {
    const customChatColor = rowToCustomChatColor(row);
    if (customChatColor == null) {
      log.warn(`getAllCustomChatColors: Skipping invalid color ${row.id}`);
      continue;
    }
    result.push(customChatColor);
  }
  return result;
}

export function createCustomChatColor(
  db: WritableDB,
  color: ChatStyle.CustomChatColor['color']
): ChatStyle.CustomChatColor {
  const { solid, gradientStart, gradientEnd, gradientAngle } =
    colorToParams(color);
  const [query, params] = sql`
    INSERT INTO customChatColors
      (solid, gradientStart, gradientEnd, gradientAngle)
    VALUES
      (${solid}, ${gradientStart}, ${gradientEnd}, ${gradientAngle})
    RETURNING id
  `;
  const row = db.prepare(query).get<{ id: number }>(params);
  if (row == null) {
    throw new Error('createCustomChatColor: Failed to insert');
  }
  return { id: row.id as ChatStyle.CustomChatColorId, color };
}

export function createCustomChatColors(
  db: WritableDB,
  colors: ReadonlyArray<ChatStyle.CustomChatColor['color']>
): ReadonlyArray<ChatStyle.CustomChatColor> {
  return db.transaction(() => {
    return colors.map(color => {
      return createCustomChatColor(db, color);
    });
  })();
}

export function updateCustomChatColor(
  db: WritableDB,
  customChatColor: ChatStyle.CustomChatColor
): void {
  const { solid, gradientStart, gradientEnd, gradientAngle } = colorToParams(
    customChatColor.color
  );
  const [query, params] = sql`
    UPDATE customChatColors
    SET
      solid = ${solid},
      gradientStart = ${gradientStart},
      gradientEnd = ${gradientEnd},
      gradientAngle = ${gradientAngle}
    WHERE id = ${customChatColor.id}
  `;
  db.prepare(query).run(params);
}

export function deleteCustomChatColor(
  db: WritableDB,
  id: ChatStyle.CustomChatColorId
): void {
  // conversation.customChatColorId and account.defaultCustomChatColorId are
  // reset to NULL via `ON DELETE SET NULL`
  const [query, params] = sql`
    DELETE FROM customChatColors
    WHERE id = ${id}
  `;
  db.prepare(query).run(params);
}

export function getExistingCustomChatColorId(
  db: ReadableDB,
  id: ChatStyle.CustomChatColorId | null | undefined,
  logId: string
): ChatStyle.CustomChatColorId | null {
  if (id == null) {
    return null;
  }
  const [query, params] = sql`
    SELECT id FROM customChatColors WHERE id = ${id}
  `;
  const row = db.prepare(query).get(params);
  if (row == null) {
    // Log if we try to save a customChatColor that has been deleted. We should
    // be sure to flush conversation saves before deleting a custom chat color,
    // so an in-memory conversation doesn't referencing the deleted ID
    log.error(`${logId}: Custom chat color ${id} does not exist`);
    return null;
  }
  return id;
}
