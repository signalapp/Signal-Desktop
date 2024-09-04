// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { random, range, sample, sortBy } from 'lodash';
import type { MIMEType } from '../../../../types/MIME';
import type { MediaItemType } from '../../../../types/MediaItem';

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
  txt: 'application/text',
} as unknown as Record<string, MIMEType>;

function createRandomFile(
  startTime: number,
  timeWindow: number,
  fileExtension: string
): MediaItemType {
  const contentType = contentTypes[fileExtension];
  const fileName = `${sample(tokens)}${sample(tokens)}.${fileExtension}`;

  return {
    contentType,
    message: {
      conversationId: '123',
      id: random(Date.now()).toString(),
      receivedAt: Math.floor(Math.random() * 10),
      receivedAtMs: random(startTime, startTime + timeWindow),
      attachments: [],
      sentAt: Date.now(),
    },
    attachment: {
      url: '',
      fileName,
      size: random(1000, 1000 * 1000 * 50),
      contentType,
    },
    index: 0,
    thumbnailObjectUrl: `https://placekitten.com/${random(50, 150)}/${random(
      50,
      150
    )}`,
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
  return createRandomFiles(startTime, timeWindow, ['docx', 'pdf', 'txt']);
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
