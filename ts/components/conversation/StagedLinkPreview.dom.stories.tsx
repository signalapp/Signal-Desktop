// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import * as React from 'react';
import { action } from '@storybook/addon-actions';

import type { Props } from './StagedLinkPreview.dom.js';
import { StagedLinkPreview } from './StagedLinkPreview.dom.js';
import { fakeAttachment } from '../../test-helpers/fakeAttachment.std.js';
import { IMAGE_JPEG } from '../../types/MIME.std.js';

const LONG_TITLE =
  "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?";
const LONG_DESCRIPTION =
  "You're gonna love this description. Not only does it have a lot of characters, but it will also be truncated in the UI. How cool is that??";

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/StagedLinkPreview',
  component: StagedLinkPreview,
} satisfies Meta<Props>;

const getDefaultProps = (): Props => ({
  date: Date.now(),
  description: 'This is a description',
  domain: 'signal.org',
  i18n,
  onClose: action('onClose'),
  title: 'This is a super-sweet site',
  url: 'https://www.signal.org',
  isCallLink: false,
});

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<Props> = args => <StagedLinkPreview {...args} />;

export const Loading = Template.bind({});
Loading.args = {
  ...getDefaultProps(),
  domain: '',
};

export const NoImage = Template.bind({});
NoImage.args = {
  ...getDefaultProps(),
};

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

export const NoImageLongTitleWithDescription = Template.bind({});
NoImageLongTitleWithDescription.args = {
  ...getDefaultProps(),
  title: LONG_TITLE,
};

export const NoImageLongTitleWithoutDescription = Template.bind({});
NoImageLongTitleWithoutDescription.args = {
  ...getDefaultProps(),
  title: LONG_TITLE,
  description: '',
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

export const CompositionInput = Template.bind({});
CompositionInput.args = {
  ...getDefaultProps(),
  moduleClassName: 'CompositionInput__link-preview',
  title: LONG_TITLE,
  description: LONG_DESCRIPTION,
  image: fakeAttachment({
    url: '/fixtures/kitten-4-112-112.jpg',
    contentType: IMAGE_JPEG,
  }),
};
