// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';

export default function updateToSchemaVersion1790(db: WritableDB): void {
  // `dontNotifyForMentionsIfMuted` is replaced by `notifyForMentionsIfMuted`.
  // Only conversations that opted out need a value written; everything else is
  // left unset so it picks up the default.
  const [query] = sql`
    UPDATE conversations
    SET json = json_remove(
      CASE json_extract(json, '$.dontNotifyForMentionsIfMuted')
        WHEN 1 THEN json_set(json, '$.notifyForMentionsIfMuted', json('false'))
        ELSE json
      END,
      '$.dontNotifyForMentionsIfMuted'
    )
    WHERE json_extract(json, '$.dontNotifyForMentionsIfMuted') IS NOT NULL;
  `;
  db.exec(query);
}
