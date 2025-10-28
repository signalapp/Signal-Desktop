// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { type MIMEType, IMAGE_JPEG } from '../../../../types/MIME.std.js';
import type { MediaItemType } from '../../../../types/MediaItem.std.js';
import { randomBlurHash } from '../../../../util/randomBlurHash.std.js';
import { SignalService } from '../../../../protobuf/index.std.js';

const { random, range, sample, sortBy } = lodash;

const DAY_MS = 24 * 60 * 60 * 1000;
export const days = (n: number): number => n * DAY_MS;
const tokens = ['foo', 'bar', 'baz', 'qux', 'quux'];

const contentTypes = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
  docx: 'application/text',
  pdf: 'application/pdf',
  exe: 'application/exe',
  txt: 'application/text',
} as unknown as Record<string, MIMEType>;

function createRandomFile(
  startTime: number,
  timeWindow: number,
  fileExtension: string
): MediaItemType {
  const contentType = contentTypes[fileExtension];
  const fileName = `${sample(tokens)}${sample(tokens)}.${fileExtension}`;

  const isDownloaded = Math.random() > 0.4;
  const isPending = !isDownloaded && Math.random() > 0.5;

  return {
    message: {
      conversationId: '123',
      type: 'incoming',
      id: random(Date.now()).toString(),
      receivedAt: Math.floor(Math.random() * 10),
      receivedAtMs: random(startTime, startTime + timeWindow),
      sentAt: Date.now(),
    },
    attachment: {
      url: isDownloaded ? '/fixtures/cat-screenshot-3x4.png' : undefined,
      path: isDownloaded ? 'abc' : undefined,
      pending: isPending,
      screenshot:
        fileExtension === 'mp4'
          ? {
              url: isDownloaded
                ? '/fixtures/cat-screenshot-3x4.png'
                : undefined,
              contentType: IMAGE_JPEG,
            }
          : undefined,
      flags:
        fileExtension === 'mp4' && Math.random() > 0.5
          ? SignalService.AttachmentPointer.Flags.GIF
          : 0,
      width: 400,
      height: 300,
      fileName,
      size: random(1000, 1000 * 1000 * 50),
      contentType,
      blurHash: randomBlurHash(),
      isPermanentlyUndownloadable: false,
    },
    index: 0,
  };
}

function createRandomFiles(
  startTime: number,
  timeWindow: number,
  fileExtensions: Array<string>
): Array<MediaItemType> {
  return range(random(5, 10)).map(() =>
    createRandomFile(startTime, timeWindow, sample(fileExtensions) as string)
  );
}
export function createRandomDocuments(
  startTime: number,
  timeWindow: number
): Array<MediaItemType> {
  return createRandomFiles(startTime, timeWindow, [
    'docx',
    'pdf',
    'exe',
    'txt',
  ]);
}

export function createRandomMedia(
  startTime: number,
  timeWindow: number
): Array<MediaItemType> {
  return createRandomFiles(startTime, timeWindow, ['mp4', 'jpg', 'png', 'gif']);
}

export function createPreparedMediaItems(
  fn: typeof createRandomDocuments | typeof createRandomMedia
): Array<MediaItemType> {
  const now = Date.now();
  return sortBy(
    [
      ...fn(now, days(1)),
      ...fn(now - days(1), days(1)),
      ...fn(now - days(3), days(3)),
      ...fn(now - days(30), days(15)),
      ...fn(now - days(365), days(300)),
    ],
    (item: MediaItemType) => -item.message.receivedAt
  );
}
