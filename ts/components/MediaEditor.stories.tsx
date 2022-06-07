// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './MediaEditor';
import { MediaEditor } from './MediaEditor';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import { Stickers, installedPacks } from '../test-both/helpers/getStickerPacks';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MediaEditor',
};

const IMAGE_1 = '/fixtures/nathan-anderson-316188-unsplash.jpg';
const IMAGE_2 = '/fixtures/tina-rolf-269345-unsplash.jpg';
const IMAGE_3 = '/fixtures/kitten-4-112-112.jpg';
const IMAGE_4 = '/fixtures/snow.jpg';

const getDefaultProps = (): PropsType => ({
  i18n,
  imageSrc: IMAGE_2,
  onClose: action('onClose'),
  onDone: action('onDone'),

  // StickerButtonProps
  installedPacks,
  recentStickers: [Stickers.wide, Stickers.tall, Stickers.abe],
});

export const ExtraLarge = (): JSX.Element => (
  <MediaEditor {...getDefaultProps()} />
);

export const Large = (): JSX.Element => (
  <MediaEditor {...getDefaultProps()} imageSrc={IMAGE_1} />
);

export const Smol = (): JSX.Element => (
  <MediaEditor {...getDefaultProps()} imageSrc={IMAGE_3} />
);

export const Portrait = (): JSX.Element => (
  <MediaEditor {...getDefaultProps()} imageSrc={IMAGE_4} />
);
