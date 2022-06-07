// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as React from 'react';
import { select, text } from '@storybook/addon-knobs';
import { random, range, sample, sortBy } from 'lodash';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { MIMEType } from '../../../types/MIME';
import type { MediaItemType } from '../../../types/MediaItem';

import type { Props } from './AttachmentSection';
import { AttachmentSection } from './AttachmentSection';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MediaGallery/AttachmentSection',
};

export const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
export const days = (n: number) => n * DAY_MS;
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

const createRandomFile = (
  startTime: number,
  timeWindow: number,
  fileExtension: string
): MediaItemType => {
  const contentType = contentTypes[fileExtension];
  const fileName = `${sample(tokens)}${sample(tokens)}.${fileExtension}`;

  return {
    contentType,
    message: {
      conversationId: '123',
      id: random(now).toString(),
      received_at: Math.floor(Math.random() * 10),
      received_at_ms: random(startTime, startTime + timeWindow),
      attachments: [],
      sent_at: Date.now(),
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
};

const createRandomFiles = (
  startTime: number,
  timeWindow: number,
  fileExtensions: Array<string>
) =>
  range(random(5, 10)).map(() =>
    createRandomFile(startTime, timeWindow, sample(fileExtensions) as string)
  );

export const createRandomDocuments = (startTime: number, timeWindow: number) =>
  createRandomFiles(startTime, timeWindow, ['docx', 'pdf', 'txt']);

export const createRandomMedia = (startTime: number, timeWindow: number) =>
  createRandomFiles(startTime, timeWindow, ['mp4', 'jpg', 'png', 'gif']);

export const createPreparedMediaItems = (
  fn: typeof createRandomDocuments | typeof createRandomMedia
) =>
  sortBy(
    [
      ...fn(now, days(1)),
      ...fn(now - days(1), days(1)),
      ...fn(now - days(3), days(3)),
      ...fn(now - days(30), days(15)),
      ...fn(now - days(365), days(300)),
    ],
    (item: MediaItemType) => -item.message.received_at
  );

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  header: text('header', 'Today'),
  type: select(
    'type',
    { media: 'media', documents: 'documents' },
    overrideProps.type || 'media'
  ),
  mediaItems: overrideProps.mediaItems || [],
});

export const Documents = () => {
  const mediaItems = createRandomDocuments(now, days(1));
  const props = createProps({ mediaItems, type: 'documents' });

  return <AttachmentSection {...props} />;
};

export const Media = () => {
  const mediaItems = createRandomMedia(now, days(1));
  const props = createProps({ mediaItems, type: 'media' });

  return <AttachmentSection {...props} />;
};
