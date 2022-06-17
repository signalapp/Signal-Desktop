// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import * as React from 'react';
import { action } from '@storybook/addon-actions';

import type { Props } from './StagedLinkPreview';
import enMessages from '../../../_locales/en/messages.json';
import { StagedLinkPreview } from './StagedLinkPreview';
import { fakeAttachment } from '../../test-both/helpers/fakeAttachment';
import { setupI18n } from '../../util/setupI18n';
import { IMAGE_JPEG } from '../../types/MIME';

const LONG_TITLE =
  "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?";
const LONG_DESCRIPTION =
  "You're gonna love this description. Not only does it have a lot of characters, but it will also be truncated in the UI. How cool is that??";

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/StagedLinkPreview',
  component: StagedLinkPreview,
} as Meta;

const getDefaultProps = (): Props => ({
  date: Date.now(),
  description: 'This is a description',
  domain: 'signal.org',
  i18n,
  onClose: action('onClose'),
  title: 'This is a super-sweet site',
  url: 'https://www.signal.org',
});

const Template: Story<Props> = args => <StagedLinkPreview {...args} />;

export const Loading = Template.bind({});
Loading.args = {
  ...getDefaultProps(),
  domain: '',
};

export const NoImage = Template.bind({});

export const Image = Template.bind({});
Image.args = {
  ...getDefaultProps(),
  image: fakeAttachment({
    url: '/fixtures/kitten-4-112-112.jpg',
    contentType: IMAGE_JPEG,
  }),
};

export const ImageNoTitleOrDescription = Template.bind({});
ImageNoTitleOrDescription.args = {
  ...getDefaultProps(),
  title: '',
  description: '',
  domain: 'instagram.com',
  image: fakeAttachment({
    url: '/fixtures/kitten-4-112-112.jpg',
    contentType: IMAGE_JPEG,
  }),
};
ImageNoTitleOrDescription.story = {
  name: 'Image, No Title Or Description',
};

export const NoImageLongTitleWithDescription = Template.bind({});
NoImageLongTitleWithDescription.args = {
  ...getDefaultProps(),
  title: LONG_TITLE,
};
NoImageLongTitleWithDescription.story = {
  name: 'No Image, Long Title With Description',
};

export const NoImageLongTitleWithoutDescription = Template.bind({});
NoImageLongTitleWithoutDescription.args = {
  ...getDefaultProps(),
  title: LONG_TITLE,
  description: '',
};
NoImageLongTitleWithoutDescription.story = {
  name: 'No Image, Long Title Without Description',
};

export const ImageLongTitleWithoutDescription = Template.bind({});
ImageLongTitleWithoutDescription.args = {
  ...getDefaultProps(),
  title: LONG_TITLE,
  image: fakeAttachment({
    url: '/fixtures/kitten-4-112-112.jpg',
    contentType: IMAGE_JPEG,
  }),
};
ImageLongTitleWithoutDescription.story = {
  name: 'Image, Long Title Without Description',
};

export const ImageLongTitleAndDescription = Template.bind({});
ImageLongTitleAndDescription.args = {
  ...getDefaultProps(),
  title: LONG_TITLE,
  description: LONG_DESCRIPTION,
  image: fakeAttachment({
    url: '/fixtures/kitten-4-112-112.jpg',
    contentType: IMAGE_JPEG,
  }),
};
ImageLongTitleAndDescription.story = {
  name: 'Image, Long Title And Description',
};

export const EverythingImageTitleDescriptionAndDate = Template.bind({});
EverythingImageTitleDescriptionAndDate.args = {
  ...getDefaultProps(),
  title: LONG_TITLE,
  description: LONG_DESCRIPTION,
  image: fakeAttachment({
    url: '/fixtures/kitten-4-112-112.jpg',
    contentType: IMAGE_JPEG,
  }),
};
EverythingImageTitleDescriptionAndDate.story = {
  name: 'Everything: image, title, description, and date',
};
