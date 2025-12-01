// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { type MIMEType, IMAGE_JPEG } from '../../../../types/MIME.std.js';
import type {
  MediaItemType,
  LinkPreviewMediaItemType,
  MediaItemMessageType,
} from '../../../../types/MediaItem.std.js';
import type { AttachmentForUIType } from '../../../../types/Attachment.std.js';
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

function createRandomAttachment(fileExtension: string): AttachmentForUIType {
  const contentType = contentTypes[fileExtension];
  const fileName = `${sample(tokens)}${sample(tokens)}.${fileExtension}`;

  const isDownloaded = Math.random() > 0.4;
  const isPending = !isDownloaded && Math.random() > 0.5;

  let file: string;

  if (fileExtension === 'mp3') {
    file = '/fixtures/incompetech-com-Agnus-Dei-X.mp3';
  } else if (fileExtension === 'mp4') {
    file = '/fixtures/cat-gif.mp4';
  } else {
    file = '/fixtures/cat-screenshot-3x4.png';
  }

  let flags = 0;
  if (fileExtension === 'mp4' && Math.random() > 0.5) {
    flags = SignalService.AttachmentPointer.Flags.GIF;
  }

  return {
    url: isDownloaded ? file : undefined,
    path: isDownloaded ? 'abc' : undefined,
    pending: isPending,
    screenshot:
      fileExtension === 'mp4'
        ? {
            url: isDownloaded ? file : undefined,
            contentType: IMAGE_JPEG,
          }
        : undefined,
    flags,
    width: 400,
    height: 300,
    fileName,
    size: random(1000, 1000 * 1000 * 50),
    contentType,
    blurHash: randomBlurHash(),
    isPermanentlyUndownloadable: false,
  };
}

function createRandomMessage(
  startTime: number,
  timeWindow: number
): MediaItemMessageType {
  return {
    conversationId: '123',
    type: 'incoming',
    id: random(Date.now()).toString(),
    receivedAt: Math.floor(Math.random() * 10),
    receivedAtMs: random(startTime, startTime + timeWindow),
    sentAt: Date.now(),

    // Unused for now
    source: undefined,
    sourceServiceId: undefined,
    isErased: false,
    readStatus: undefined,
    sendStateByConversationId: undefined,
    errors: undefined,
  };
}

function createRandomFile(
  type: 'media' | 'document' | 'audio',
  startTime: number,
  timeWindow: number,
  fileExtension: string
): MediaItemType {
  return {
    type,
    message: createRandomMessage(startTime, timeWindow),
    attachment: createRandomAttachment(fileExtension),
    index: 0,
  };
}

function createRandomLink(
  startTime: number,
  timeWindow: number
): LinkPreviewMediaItemType {
  return {
    type: 'link',
    message: createRandomMessage(startTime, timeWindow),
    preview: {
      url: 'https://signal.org/',
      domain: 'signal.org',
      title: 'Signal',
      description: 'description',
      image: Math.random() > 0.7 ? createRandomAttachment('png') : undefined,
    },
  };
}

function createRandomFiles(
  type: 'media' | 'document' | 'audio',
  startTime: number,
  timeWindow: number,
  fileExtensions: Array<string>
): Array<MediaItemType> {
  return range(random(5, 20)).map(() =>
    createRandomFile(
      type,
      startTime,
      timeWindow,
      sample(fileExtensions) as string
    )
  );
}
export function createRandomDocuments(
  startTime: number,
  timeWindow: number
): Array<MediaItemType> {
  return createRandomFiles('document', startTime, timeWindow, [
    'docx',
    'pdf',
    'exe',
    'txt',
  ]);
}
export function createRandomLinks(
  startTime: number,
  timeWindow: number
): Array<LinkPreviewMediaItemType> {
  return range(random(5, 10)).map(() =>
    createRandomLink(startTime, timeWindow)
  );
}
export function createRandomAudio(
  startTime: number,
  timeWindow: number
): Array<MediaItemType> {
  return createRandomFiles('audio', startTime, timeWindow, ['mp3']);
}

export function createRandomMedia(
  startTime: number,
  timeWindow: number
): Array<MediaItemType> {
  return createRandomFiles('media', startTime, timeWindow, [
    'mp4',
    'jpg',
    'png',
    'gif',
  ]);
}

export function createPreparedMediaItems<
  Item extends MediaItemType | LinkPreviewMediaItemType,
>(fn: (startTime: number, timeWindow: number) => Array<Item>): Array<Item> {
  const now = Date.now();
  return sortBy<Item>(
    [
      ...fn(now, days(1)),
      ...fn(now - days(1), days(1)),
      ...fn(now - days(3), days(3)),
      ...fn(now - days(30), days(15)),
      ...fn(now - days(365), days(300)),
    ],
    item => -item.message.receivedAt
  );
}
