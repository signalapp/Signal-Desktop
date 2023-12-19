// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './MediaEditor';
import { MediaEditor } from './MediaEditor';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import { Stickers, installedPacks } from '../test-both/helpers/getStickerPacks';

const i18n = setupI18n('en', enMessages);
const IMAGE_1 = '/fixtures/nathan-anderson-316188-unsplash.jpg';
const IMAGE_2 = '/fixtures/tina-rolf-269345-unsplash.jpg';
const IMAGE_3 = '/fixtures/kitten-4-112-112.jpg';
const IMAGE_4 = '/fixtures/snow.jpg';

export default {
  title: 'Components/MediaEditor',
  component: MediaEditor,
  args: {
    getPreferredBadge: () => undefined,
    i18n,
    imageToBlurHash: input => Promise.resolve(input.toString()),
    imageSrc: IMAGE_2,
    installedPacks,
    isFormattingEnabled: true,
    isSending: false,
    onClose: action('onClose'),
    onDone: action('onDone'),
    onPickEmoji: action('onPickEmoji'),
    onTextTooLong: action('onTextTooLong'),
    platform: 'darwin',
    recentStickers: [Stickers.wide, Stickers.tall, Stickers.abe],
    skinTone: 0,
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <MediaEditor {...args} />;

export const ExtraLarge = Template.bind({});

export const Large = Template.bind({});
Large.args = {
  imageSrc: IMAGE_1,
};

export const Smol = Template.bind({});
Smol.args = {
  imageSrc: IMAGE_3,
};

export const Portrait = Template.bind({});
Portrait.args = {
  imageSrc: IMAGE_4,
};

export const Sending = Template.bind({});
Sending.args = {
  isSending: true,
};
