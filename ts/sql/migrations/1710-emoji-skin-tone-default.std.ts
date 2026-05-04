// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';

export default function updateToSchemaVersion1710(db: WritableDB): void {
  const [query] = sql`
    UPDATE items
    SET json = json_set(
      json,
      '$.value',
      CASE json_extract(json, '$.value')
        WHEN 'EmojiSkinTone.None' THEN ''
        WHEN 'EmojiSkinTone.Type1' THEN '1F3FB'
        WHEN 'EmojiSkinTone.Type2' THEN '1F3FC'
        WHEN 'EmojiSkinTone.Type3' THEN '1F3FD'
        WHEN 'EmojiSkinTone.Type4' THEN '1F3FE'
        WHEN 'EmojiSkinTone.Type5' THEN '1F3FF'
        ELSE ''
      END
    )
    WHERE id IS 'emojiSkinToneDefault';
  `;
  db.exec(query);
}
