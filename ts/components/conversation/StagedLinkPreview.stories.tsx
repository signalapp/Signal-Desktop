// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, date, text, withKnobs } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { AttachmentType } from '../../types/Attachment';
import { MIMEType } from '../../types/MIME';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { Props, StagedLinkPreview } from './StagedLinkPreview';

const LONG_TITLE =
  "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?";
const LONG_DESCRIPTION =
  "You're gonna love this description. Not only does it have a lot of characters, but it will also be truncated in the UI. How cool is that??";

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/StagedLinkPreview', module);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
story.addDecorator((withKnobs as any)({ escapeHTML: false }));

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  contentType: text(
    'attachment contentType',
    props.contentType || ''
  ) as MIMEType,
  fileName: text('attachment fileName', props.fileName || ''),
  url: text('attachment url', props.url || ''),
});

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  isLoaded: boolean('isLoaded', overrideProps.isLoaded !== false),
  title: text(
    'title',
    typeof overrideProps.title === 'string'
      ? overrideProps.title
      : 'This is a super-sweet site'
  ),
  description: text(
    'description',
    typeof overrideProps.description === 'string'
      ? overrideProps.description
      : 'This is a description'
  ),
  date: date('date', new Date(overrideProps.date || 0)),
  domain: text('domain', overrideProps.domain || 'signal.org'),
  image: overrideProps.image,
  i18n,
  onClose: action('onClose'),
});

story.add('Loading', () => {
  const props = createProps({
    isLoaded: false,
  });

  return <StagedLinkPreview {...props} />;
});

story.add('No Image', () => {
  return <StagedLinkPreview {...createProps()} />;
});

story.add('Image', () => {
  const props = createProps({
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: 'image/jpeg' as MIMEType,
    }),
  });

  return <StagedLinkPreview {...props} />;
});

story.add('Image, No Title Or Description', () => {
  const props = createProps({
    title: '',
    description: '',
    domain: 'instagram.com',
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: 'image/jpeg' as MIMEType,
    }),
  });

  return <StagedLinkPreview {...props} />;
});

story.add('No Image, Long Title With Description', () => {
  const props = createProps({
    title: LONG_TITLE,
  });

  return <StagedLinkPreview {...props} />;
});

story.add('No Image, Long Title Without Description', () => {
  const props = createProps({
    title: LONG_TITLE,
    description: '',
  });

  return <StagedLinkPreview {...props} />;
});

story.add('Image, Long Title Without Description', () => {
  const props = createProps({
    title: LONG_TITLE,
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: 'image/jpeg' as MIMEType,
    }),
  });

  return <StagedLinkPreview {...props} />;
});

story.add('Image, Long Title And Description', () => {
  const props = createProps({
    title: LONG_TITLE,
    description: LONG_DESCRIPTION,
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: 'image/jpeg' as MIMEType,
    }),
  });

  return <StagedLinkPreview {...props} />;
});

story.add('Everything: image, title, description, and date', () => {
  const props = createProps({
    title: LONG_TITLE,
    description: LONG_DESCRIPTION,
    date: Date.now(),
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: 'image/jpeg' as MIMEType,
    }),
  });

  return <StagedLinkPreview {...props} />;
});
