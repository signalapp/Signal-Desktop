import * as React from 'react';
import { random, range, sample, sortBy } from 'lodash';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

// @ts-ignore
import { setup as setupI18n } from '../../../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../../../_locales/en/messages.json';

import { MediaItemType } from '../../LightboxGallery';
import { MIMEType } from '../../../types/MIME';

import { MediaGallery, Props } from './MediaGallery';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/MediaGallery/MediaGallery',
  module
);

const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const days = (n: number) => n * DAY_MS;
const tokens = ['foo', 'bar', 'baz', 'qux', 'quux'];

const contentTypes = ({
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
  docx: 'application/text',
  pdf: 'application/pdf',
  txt: 'application/text',
} as unknown) as Record<string, MIMEType>;

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
      id: random(now).toString(),
      received_at: random(startTime, startTime + timeWindow),
      attachments: [],
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

const createRandomDocuments = (startTime: number, timeWindow: number) =>
  createRandomFiles(startTime, timeWindow, ['docx', 'pdf', 'txt']);

const createRandomMedia = (startTime: number, timeWindow: number) =>
  createRandomFiles(startTime, timeWindow, ['mp4', 'jpg', 'png', 'gif']);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  onItemClick: action('onItemClick'),
  documents: overrideProps.documents || [],
  media: overrideProps.media || [],
});

story.add('Populated', () => {
  const media = sortBy(
    [
      ...createRandomMedia(now, days(1)),
      ...createRandomMedia(now - days(1), days(1)),
      ...createRandomMedia(now - days(3), days(3)),
      ...createRandomMedia(now - days(30), days(15)),
      ...createRandomMedia(now - days(365), days(300)),
    ],
    (document: MediaItemType) => -document.message.received_at
  );

  const documents = sortBy(
    [
      ...createRandomDocuments(now, days(1)),
      ...createRandomDocuments(now - days(1), days(1)),
      ...createRandomDocuments(now - days(3), days(3)),
      ...createRandomDocuments(now - days(30), days(15)),
      ...createRandomDocuments(now - days(365), days(300)),
    ],
    (document: MediaItemType) => -document.message.received_at
  );

  const props = createProps({ documents, media });

  return <MediaGallery {...props} />;
});

story.add('No Documents', () => {
  const media = sortBy(
    [
      ...createRandomMedia(now, days(1)),
      ...createRandomMedia(now - days(1), days(1)),
      ...createRandomMedia(now - days(3), days(3)),
      ...createRandomMedia(now - days(30), days(15)),
      ...createRandomMedia(now - days(365), days(300)),
    ],
    (document: MediaItemType) => -document.message.received_at
  );

  const props = createProps({ media });

  return <MediaGallery {...props} />;
});

story.add('No Media', () => {
  const documents = sortBy(
    [
      ...createRandomDocuments(now, days(1)),
      ...createRandomDocuments(now - days(1), days(1)),
      ...createRandomDocuments(now - days(3), days(3)),
      ...createRandomDocuments(now - days(30), days(15)),
      ...createRandomDocuments(now - days(365), days(300)),
    ],
    (document: MediaItemType) => -document.message.received_at
  );

  const props = createProps({ documents });

  return <MediaGallery {...props} />;
});

story.add('One Each', () => {
  const media = createRandomMedia(now, days(1)).slice(0, 1);
  const documents = createRandomDocuments(now, days(1)).slice(0, 1);

  const props = createProps({ documents, media });

  return <MediaGallery {...props} />;
});

story.add('Empty', () => {
  const props = createProps();

  return <MediaGallery {...props} />;
});
