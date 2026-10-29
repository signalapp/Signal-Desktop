// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type {
  ReadableDB,
  StickerPackStatusType,
  StickerType,
  WritableDB,
} from '../Interface.std.ts';
import { sql } from '../util.std.ts';
import type {
  FavoriteStickerStatusType,
  FavoriteStickerType,
  StickerReferenceType,
} from '../../types/Stickers.preload.ts';
import { dropNull } from '../../util/dropNull.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

export type StickerRow = Readonly<{
  id: number;
  packId: string;
  emoji: string | null;
  height: number;
  isCoverOnly: number;
  lastUsed: number;
  path: string;
  width: number;
  version: 1 | 2;
  localKey: string | null;
  size: number | null;
}>;

export type FavoriteStickerRow = Readonly<
  Omit<
    FavoriteStickerType,
    | 'deletedAtTimestampMs'
    | 'favoritedAtTimestampMs'
    | 'packKey'
    | 'storageNeedsSync'
  > & {
    packKey: string | null;
    deletedAtTimestampMs: number | null;
    favoritedAtTimestampMs: number | null;
    storageNeedsSync: 0 | 1;
  }
>;

// Helpers

function favoriteStickerToRow(
  favoriteSticker: FavoriteStickerType
): FavoriteStickerRow {
  return {
    ...favoriteSticker,
    packKey: favoriteSticker.packKey || null,
    deletedAtTimestampMs: favoriteSticker.deletedAtTimestampMs || null,
    favoritedAtTimestampMs: favoriteSticker.favoritedAtTimestampMs || null,
    storageID: favoriteSticker.storageID || null,
    storageVersion: favoriteSticker.storageVersion || null,
    storageNeedsSync: favoriteSticker.storageNeedsSync ? 1 : 0,
    storageUnknownFields: favoriteSticker.storageUnknownFields || null,
  };
}

function rowToFavoriteSticker(row: FavoriteStickerRow): FavoriteStickerType {
  return {
    ...row,
    packKey: row.packKey || undefined,
    deletedAtTimestampMs: row.deletedAtTimestampMs || undefined,
    favoritedAtTimestampMs: row.favoritedAtTimestampMs || undefined,
    storageID: row.storageID || undefined,
    storageVersion: row.storageVersion || undefined,
    storageNeedsSync: Boolean(row.storageNeedsSync),
    storageUnknownFields: row.storageUnknownFields || undefined,
  };
}

export function rowToSticker(row: StickerRow): StickerType {
  return {
    ...row,
    isCoverOnly: Boolean(row.isCoverOnly),
    emoji:
      row.emoji != null
        ? Emoji.unsafeCastMaybeInvalidStringToVariant(row.emoji)
        : undefined,
    version: row.version || 1,
    localKey: dropNull(row.localKey),
    size: dropNull(row.size),
  };
}

// Read

export function getAllFavoriteStickers(
  db: ReadableDB
): ReadonlyArray<FavoriteStickerType> {
  const [query, params] = sql`
    SELECT * FROM favorite_stickers
    ORDER BY favoritedAtTimestampMs DESC;
  `;
  return db
    .prepare(query)
    .all<FavoriteStickerRow>(params)
    .map(row => rowToFavoriteSticker(row));
}

export function getAllInstalledFavoriteStickers(
  db: ReadableDB
): ReadonlyArray<StickerType> {
  const rows = db
    .prepare(
      `
      SELECT
        stickers.*,
        favorite_stickers.favoritedAtTimestampMs
      FROM stickers
      JOIN favorite_stickers
        ON stickers.packId = favorite_stickers.packId AND
        stickers.id = favorite_stickers.stickerId
      WHERE
        deletedAtTimestampMs IS NULL OR
        deletedAtTimestampMs IS 0
      ORDER BY favorite_stickers.favoritedAtTimestampMs DESC
      `
    )
    .all<StickerRow>();
  return (rows || []).map(row => rowToSticker(row));
}

export function getFavoriteStickersFromPack(
  db: ReadableDB,
  packId: string
): ReadonlyArray<FavoriteStickerType> {
  const [query, params] = sql`
    SELECT * FROM favorite_stickers
    WHERE packId = ${packId};
  `;
  return db
    .prepare(query)
    .all<FavoriteStickerRow>(params)
    .map(row => rowToFavoriteSticker(row));
}

export function getFavoriteSticker(
  db: ReadableDB,
  { packId, stickerId }: StickerReferenceType
): FavoriteStickerType | undefined {
  const [query, parameters] = sql`
    SELECT * FROM favorite_stickers
    WHERE
      packId = ${packId} AND
      stickerId = ${stickerId};
  `;
  const row = db.prepare(query).get<FavoriteStickerRow>(parameters);

  return row ? rowToFavoriteSticker(row) : undefined;
}

export function getSticker(
  db: ReadableDB,
  { packId, stickerId }: StickerReferenceType
): StickerType | undefined {
  const [query, parameters] = sql`
    SELECT * FROM stickers
    WHERE
      id = ${stickerId} AND
      packId = ${packId};
  `;
  const row = db.prepare(query).get<StickerRow>(parameters);

  return row ? rowToSticker(row) : undefined;
}

function getKeyFromStickerPack(
  db: ReadableDB,
  packId: string
): string | undefined {
  const stickerPack = db
    .prepare(
      `
      SELECT key FROM sticker_packs
      WHERE id IS $packId
      `
    )
    .get<{ key: string }>({ packId });
  return stickerPack?.key;
}

// Write

export function createFavoriteSticker(
  db: WritableDB,
  sticker: FavoriteStickerType
): void {
  const row = favoriteStickerToRow(sticker);

  db.prepare(
    `
      INSERT INTO favorite_stickers(
        packId,
        stickerId,
        packKey,
        favoritedAtTimestampMs,
        deletedAtTimestampMs,
        status,
        storageID,
        storageVersion,
        storageUnknownFields,
        storageNeedsSync
      ) VALUES (
        $packId,
        $stickerId,
        $packKey,
        $favoritedAtTimestampMs,
        $deletedAtTimestampMs,
        $status,
        $storageID,
        $storageVersion,
        $storageUnknownFields,
        $storageNeedsSync
      );
      `
  ).run(row);
}

export function addFavoriteStickerFromStickerRef(
  db: WritableDB,
  { packId, stickerId }: StickerReferenceType
): FavoriteStickerType | undefined {
  return db.transaction(() => {
    const existingFavorite = getFavoriteSticker(db, { packId, stickerId });
    if (existingFavorite) {
      const { deletedAtTimestampMs, favoritedAtTimestampMs } = existingFavorite;
      if (!deletedAtTimestampMs && favoritedAtTimestampMs) {
        return existingFavorite;
      }
    }

    const packKey =
      existingFavorite?.packKey ?? getKeyFromStickerPack(db, packId);
    if (!packKey) {
      return undefined;
    }

    const isStickerInstalled = Boolean(getSticker(db, { packId, stickerId }));
    const updatedProps: Pick<
      FavoriteStickerType,
      | 'packKey'
      | 'favoritedAtTimestampMs'
      | 'deletedAtTimestampMs'
      | 'status'
      | 'storageNeedsSync'
    > = {
      packKey,
      favoritedAtTimestampMs: new Date().getTime(),
      deletedAtTimestampMs: undefined,
      status: isStickerInstalled ? 'installed' : 'known',
      storageNeedsSync: true,
    };

    let favoriteSticker: FavoriteStickerType;
    if (existingFavorite) {
      favoriteSticker = {
        ...existingFavorite,
        ...updatedProps,
      };
      updateFavoriteSticker(db, favoriteSticker);
    } else {
      favoriteSticker = {
        ...updatedProps,
        packId,
        stickerId,
      };
      createFavoriteSticker(db, favoriteSticker);
    }

    return favoriteSticker;
  })();
}

export function updateFavoriteSticker(
  db: WritableDB,
  sticker: FavoriteStickerType
): void {
  const row = favoriteStickerToRow(sticker);

  db.prepare(
    `
    UPDATE favorite_stickers SET
      packKey = $packKey,
      favoritedAtTimestampMs = $favoritedAtTimestampMs,
      deletedAtTimestampMs = $deletedAtTimestampMs,
      status = $status,
      storageID = $storageID,
      storageVersion = $storageVersion,
      storageUnknownFields = $storageUnknownFields,
      storageNeedsSync = $storageNeedsSync
    WHERE
      packId = $packId AND
      stickerId = $stickerId;
    `
  ).run(row);
}

export function updateFavoriteStickerStatus(
  db: WritableDB,
  { packId, stickerId }: StickerReferenceType,
  status: FavoriteStickerStatusType
): void {
  db.prepare(
    `
    UPDATE favorite_stickers SET
      status = $status
    WHERE
      packId = $packId AND
      stickerId = $stickerId;
    `
  ).run({ packId, stickerId, status });
}

export function markFavoriteStickerDeleted(
  db: WritableDB,
  { packId, stickerId }: StickerReferenceType
): { deletedAtTimestampMs: number; storageNeedsSync: boolean } | undefined {
  const favoriteSticker = getFavoriteSticker(db, { packId, stickerId });
  if (favoriteSticker && favoriteSticker.deletedAtTimestampMs) {
    const { deletedAtTimestampMs, storageNeedsSync } = favoriteSticker;
    return { deletedAtTimestampMs, storageNeedsSync };
  }

  const now = new Date().getTime();
  const [query, parameters] = sql`
      UPDATE favorite_stickers
      SET
        deletedAtTimestampMs = ${now},
        storageNeedsSync = 1
      WHERE
        packId = ${packId} AND
        stickerId = ${stickerId} AND
        deletedAtTimestampMs IS NULL
      RETURNING deletedAtTimestampMs`;

  const record = db
    .prepare(query)
    .get<{ deletedAtTimestampMs: number }>(parameters);

  if (!record) {
    return undefined;
  }

  return {
    deletedAtTimestampMs: record.deletedAtTimestampMs,
    storageNeedsSync: true,
  };
}

export function deleteFavoriteSticker(
  db: WritableDB,
  { packId, stickerId }: StickerReferenceType
): void {
  const [query, parameters] = sql`
    DELETE FROM favorite_stickers
    WHERE
      packId = ${packId} AND
      stickerId = ${stickerId};
  `;
  db.prepare(query).run(parameters);
}

// This only deletes stickers from partially downloaded packs like for favorites.
// It does not delete stickers from 'downloaded' or 'installed' packs.
export function maybeDeleteSticker(
  db: WritableDB,
  { packId, stickerId }: StickerReferenceType
): string | undefined {
  if (!packId) {
    throw new Error(
      'deleteSticker: Provided data did not have a truthy packId'
    );
  }

  return db.transaction(() => {
    const packRow = db
      .prepare(
        `
          SELECT status FROM sticker_packs
          WHERE id = $packId;
          `
      )
      .get<{ status: StickerPackStatusType }>({ packId });
    if (!packRow) {
      return undefined;
    }
    const { status } = packRow;

    if (status === 'installed' || status === 'downloaded') {
      return undefined;
    }

    return db
      .prepare(
        `
        DELETE FROM stickers
        WHERE
          packId = $packId AND
          id = $stickerId
        RETURNING path;
        `,
        {
          pluck: true,
        }
      )
      .get<string>({ packId, stickerId });
  })();
}
