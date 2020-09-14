import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';

import {
  createPreparedMediaItems,
  createRandomDocuments,
  createRandomMedia,
  days,
  now,
} from './AttachmentSection.stories';
import { MediaGallery, Props } from './MediaGallery';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/MediaGallery/MediaGallery',
  module
);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  onItemClick: action('onItemClick'),
  documents: overrideProps.documents || [],
  media: overrideProps.media || [],
});

story.add('Populated', () => {
  const documents = createRandomDocuments(now, days(1)).slice(0, 1);
  const media = createPreparedMediaItems(createRandomMedia);
  const props = createProps({ documents, media });

  return <MediaGallery {...props} />;
});

story.add('No Documents', () => {
  const media = createPreparedMediaItems(createRandomMedia);
  const props = createProps({ media });

  return <MediaGallery {...props} />;
});

story.add('No Media', () => {
  const documents = createPreparedMediaItems(createRandomDocuments);
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
