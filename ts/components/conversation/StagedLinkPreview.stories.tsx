// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { date, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { AttachmentType } from '../../types/Attachment';
import { stringToMIMEType } from '../../types/MIME';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './StagedLinkPreview';
import { StagedLinkPreview } from './StagedLinkPreview';

const LONG_TITLE =
  "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?";
const LONG_DESCRIPTION =
  "You're gonna love this description. Not only does it have a lot of characters, but it will also be truncated in the UI. How cool is that??";

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/StagedLinkPreview',
};

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  contentType: stringToMIMEType(
    text('attachment contentType', props.contentType || '')
  ),
  fileName: text('attachment fileName', props.fileName || ''),
  url: text('attachment url', props.url || ''),
  size: 24325,
});

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
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

export const Loading = (): JSX.Element => {
  const props = createProps({ domain: '' });

  return <StagedLinkPreview {...props} />;
};

export const NoImage = (): JSX.Element => {
  return <StagedLinkPreview {...createProps()} />;
};

export const Image = (): JSX.Element => {
  const props = createProps({
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: stringToMIMEType('image/jpeg'),
    }),
  });

  return <StagedLinkPreview {...props} />;
};

export const ImageNoTitleOrDescription = (): JSX.Element => {
  const props = createProps({
    title: '',
    description: '',
    domain: 'instagram.com',
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: stringToMIMEType('image/jpeg'),
    }),
  });

  return <StagedLinkPreview {...props} />;
};

ImageNoTitleOrDescription.story = {
  name: 'Image, No Title Or Description',
};

export const NoImageLongTitleWithDescription = (): JSX.Element => {
  const props = createProps({
    title: LONG_TITLE,
  });

  return <StagedLinkPreview {...props} />;
};

NoImageLongTitleWithDescription.story = {
  name: 'No Image, Long Title With Description',
};

export const NoImageLongTitleWithoutDescription = (): JSX.Element => {
  const props = createProps({
    title: LONG_TITLE,
    description: '',
  });

  return <StagedLinkPreview {...props} />;
};

NoImageLongTitleWithoutDescription.story = {
  name: 'No Image, Long Title Without Description',
};

export const ImageLongTitleWithoutDescription = (): JSX.Element => {
  const props = createProps({
    title: LONG_TITLE,
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: stringToMIMEType('image/jpeg'),
    }),
  });

  return <StagedLinkPreview {...props} />;
};

ImageLongTitleWithoutDescription.story = {
  name: 'Image, Long Title Without Description',
};

export const ImageLongTitleAndDescription = (): JSX.Element => {
  const props = createProps({
    title: LONG_TITLE,
    description: LONG_DESCRIPTION,
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: stringToMIMEType('image/jpeg'),
    }),
  });

  return <StagedLinkPreview {...props} />;
};

ImageLongTitleAndDescription.story = {
  name: 'Image, Long Title And Description',
};

export const EverythingImageTitleDescriptionAndDate = (): JSX.Element => {
  const props = createProps({
    title: LONG_TITLE,
    description: LONG_DESCRIPTION,
    date: Date.now(),
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: stringToMIMEType('image/jpeg'),
    }),
  });

  return <StagedLinkPreview {...props} />;
};

EverythingImageTitleDescriptionAndDate.story = {
  name: 'Everything: image, title, description, and date',
};
