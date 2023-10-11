// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import type { Props } from './StoryLinkPreview';
import enMessages from '../../_locales/en/messages.json';
import { StoryLinkPreview } from './StoryLinkPreview';
import { fakeAttachment } from '../test-both/helpers/fakeAttachment';
import { setupI18n } from '../util/setupI18n';
import { IMAGE_JPEG } from '../types/MIME';

const LONG_TITLE =
  "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?";
const LONG_DESCRIPTION =
  "You're gonna love this description. Not only does it have a lot of characters, but it will also be truncated in the UI. How cool is that??";

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoryLinkPreview',
  component: StoryLinkPreview,
  args: {
    description:
      'Introducing Mac Studio. Stunningly compact. Endless connectivity. And astonishing performance with M1 Max or the new M1 Ultra chip.',
    forceCompactMode: false,
    i18n,
    image: fakeAttachment({
      // url: 'https://www.apple.com/v/mac-studio/c/images/meta/mac-studio_overview__eedzbosm1t26_og.png',
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: IMAGE_JPEG,
    }),
    title: 'Mac Studio',
    url: 'https://www.apple.com/mac-studio/',
  },
} satisfies Meta<Props>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<Props> = args => <StoryLinkPreview {...args} />;

export const Default = Template.bind({});

export const CompactMode = Template.bind({});
CompactMode.args = {
  forceCompactMode: true,
};

export const NoImage = Template.bind({});
NoImage.args = {
  image: undefined,
};

export const ImageNoDescription = Template.bind({});
ImageNoDescription.args = {
  description: '',
};
ImageNoDescription.storyName = 'Image, No Description';

export const ImageNoTitleOrDescription = Template.bind({});
ImageNoTitleOrDescription.args = {
  title: '',
  description: '',
};
ImageNoTitleOrDescription.storyName = 'Image, No Title Or Description';

export const NoImageNoTitleOrDescription = Template.bind({});
NoImageNoTitleOrDescription.args = {
  image: undefined,
  title: '',
  description: '',
};
NoImageNoTitleOrDescription.storyName = 'Just URL';

export const NoImageLongTitleWithDescription = Template.bind({});
NoImageLongTitleWithDescription.args = {
  image: undefined,
  title: LONG_TITLE,
};
NoImageLongTitleWithDescription.storyName =
  'No Image, Long Title With Description';

export const NoImageLongTitleWithoutDescription = Template.bind({});
NoImageLongTitleWithoutDescription.args = {
  image: undefined,
  title: LONG_TITLE,
  description: '',
};
NoImageLongTitleWithoutDescription.storyName =
  'No Image, Long Title Without Description';

export const ImageLongTitleWithoutDescription = Template.bind({});
ImageLongTitleWithoutDescription.args = {
  description: '',
  title: LONG_TITLE,
};
ImageLongTitleWithoutDescription.storyName =
  'Image, Long Title Without Description';

export const ImageLongTitleAndDescription = Template.bind({});
ImageLongTitleAndDescription.args = {
  title: LONG_TITLE,
  description: LONG_DESCRIPTION,
};
ImageLongTitleAndDescription.storyName = 'Image, Long Title And Description';
