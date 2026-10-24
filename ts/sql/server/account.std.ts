// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Account } from '../../types/Account.std.ts';
import type { ChatStyle } from '../../types/ChatStyle.std.ts';
import { isBubbleColorPreset } from '../../types/ChatStyle.std.ts';
import type { ReadableDB, WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';
import { strictAssert } from '../../util/assert.std.ts';

type AccountRow = Readonly<{
  defaultBubbleColorPreset: string | null;
  defaultCustomChatColorId: number | null;
}>;

function rowToDefaultBubbleColor(
  row: AccountRow
): ChatStyle['bubbleColor'] | null {
  if (row.defaultCustomChatColorId != null) {
    return {
      customChatColorId:
        row.defaultCustomChatColorId as ChatStyle.CustomChatColorId,
    };
  }
  if (
    row.defaultBubbleColorPreset != null &&
    isBubbleColorPreset(row.defaultBubbleColorPreset)
  ) {
    return { bubbleColorPreset: row.defaultBubbleColorPreset };
  }
  return null;
}

export function getAccount(db: ReadableDB): Account {
  const [query, params] = sql`
    SELECT defaultBubbleColorPreset, defaultCustomChatColorId
    FROM account
    WHERE id = 1
  `;
  const row = db.prepare(query).get<AccountRow>(params);
  strictAssert(row != null, 'getAccount: Missing account row');

  return {
    defaultBubbleColor: rowToDefaultBubbleColor(row),
  };
}

export function updateAccountDefaultBubbleColor(
  db: WritableDB,
  bubbleColor: ChatStyle['bubbleColor'] | null
): void {
  const preset = bubbleColor?.bubbleColorPreset ?? null;
  const customChatColorId = bubbleColor?.customChatColorId ?? null;

  // Deleted colors intentionally fail the foreign key constraint.
  const [query, params] = sql`
    UPDATE account
    SET
      defaultBubbleColorPreset = ${preset},
      defaultCustomChatColorId = ${customChatColorId}
    WHERE id = 1
  `;
  const { changes } = db.prepare(query).run(params);
  strictAssert(
    changes === 1,
    'updateAccountDefaultBubbleColor: Missing account row'
  );
}
