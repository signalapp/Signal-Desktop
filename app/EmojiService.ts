// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as z from 'zod';
import { protocol } from 'electron';
import { LRUCache } from 'lru-cache';

import type { OptionalResourceService } from './OptionalResourceService';
import { SignalService as Proto } from '../ts/protobuf';
import { parseUnknown } from '../ts/util/schemas';

const MANIFEST_PATH = join(__dirname, '..', 'build', 'jumbomoji.json');

const manifestSchema = z.record(z.string(), z.string().array());

function utf16ToEmoji(utf16: string): string {
  const codePoints = new Array<number>();
  const buf = Buffer.from(utf16, 'hex');
  for (let i = 0; i < buf.length; i += 2) {
    codePoints.push(buf.readUint16BE(i));
  }
  return String.fromCodePoint(...codePoints);
}

export type ManifestType = z.infer<typeof manifestSchema>;

type EmojiEntryType = Readonly<{
  utf16: string;
  sheet: string;
}>;

type SheetCacheEntry = Map<string, Uint8Array>;

export class EmojiService {
  readonly #emojiMap = new Map<string, EmojiEntryType>();

  readonly #sheetCache = new LRUCache<string, SheetCacheEntry>({
    // Each sheet is roughly 500kb
    max: 10,
  });

  private constructor(
    private readonly resourceService: OptionalResourceService,
    manifest: ManifestType
  ) {
    protocol.handle('emoji', async req => {
      const url = new URL(req.url);
      const emoji = url.searchParams.get('emoji');
      if (!emoji) {
        return new Response('invalid', { status: 400 });
      }

      return this.#fetch(emoji);
    });

    for (const [sheet, emojiList] of Object.entries(manifest)) {
      for (const utf16 of emojiList) {
        this.#emojiMap.set(utf16ToEmoji(utf16), { sheet, utf16 });
      }
    }
  }

  public static async create(
    resourceService: OptionalResourceService
  ): Promise<EmojiService> {
    const contents = await readFile(MANIFEST_PATH, 'utf8');
    const json: unknown = JSON.parse(contents);
    const manifest = parseUnknown(manifestSchema, json);
    return new EmojiService(resourceService, manifest);
  }

  async #fetch(emoji: string): Promise<Response> {
    const entry = this.#emojiMap.get(emoji);
    if (!entry) {
      return new Response('entry not found', { status: 404 });
    }

    const { sheet, utf16 } = entry;

    let imageMap = this.#sheetCache.get(sheet);
    if (!imageMap) {
      const proto = await this.resourceService.getData(
        `emoji-sheet-${sheet}.proto`
      );
      if (!proto) {
        return new Response('resource not found', { status: 404 });
      }

      const pack = Proto.JumbomojiPack.decode(proto);

      imageMap = new Map(
        pack.items.map(({ name, image }) => [
          name ?? '',
          image || new Uint8Array(0),
        ])
      );
      this.#sheetCache.set(sheet, imageMap);
    }

    const image = imageMap.get(utf16);
    if (!image) {
      return new Response('image not found', { status: 404 });
    }

    return new Response(image, {
      status: 200,
      headers: {
        'content-type': 'image/webp',
        'cache-control': 'public, max-age=2592000, immutable',
      },
    });
  }
}
