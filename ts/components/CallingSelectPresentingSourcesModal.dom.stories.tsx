// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { CallingSelectPresentingSourcesModal } from './CallingSelectPresentingSourcesModal.dom.tsx';
import type {
  PresentableSource,
  PresentableSourceImage,
} from '../types/Calling.std.ts';
import { Uint16 } from '@signalapp/types';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CallingSelectPresentingSourcesModal',
} satisfies Meta;

const SOURCE_SCREEN_THUMBNAIL: PresentableSourceImage = {
  src: 'fixtures/presenting-source-screen.png',
  width: Uint16.fromNumber(640),
  height: Uint16.fromNumber(416),
};

const SOURCE_WINDOW_THUMBNAIL: PresentableSourceImage = {
  src: 'fixtures/presenting-source-window.png',
  width: Uint16.fromNumber(640),
  height: Uint16.fromNumber(430),
};

const SOURCE_WINDOW_THUMBNAIL_BROKEN: PresentableSourceImage = {
  src: 'fixtures/THIS_PATH_SHOULD_NEVER_EXIST.png',
  width: Uint16.fromNumber(640),
  height: Uint16.fromNumber(430),
};

const SOURCE_SCREEN: PresentableSource = {
  id: 'SOURCE_SCREEN',
  name: 'Screen 1',
  isScreen: true,
  thumbnail: SOURCE_SCREEN_THUMBNAIL,
  appIcon: null,
};

const SOURCE_WINDOW_1: PresentableSource = {
  id: 'SOURCE_WINDOW_1',
  name: 'Bozirro Airhorse',
  isScreen: false,
  thumbnail: SOURCE_WINDOW_THUMBNAIL,
  appIcon: null,
};

const SOURCE_WINDOW_2: PresentableSource = {
  id: 'SOURCE_WINDOW_2',
  name: 'Discoverer',
  isScreen: false,
  thumbnail: SOURCE_WINDOW_THUMBNAIL,
  appIcon: null,
};

const SOURCE_WINDOW_BROKEN: PresentableSource = {
  id: 'SOURCE_WINDOW_BROKEN',
  name: 'Signal Beta',
  isScreen: false,
  thumbnail: SOURCE_WINDOW_THUMBNAIL_BROKEN,
  appIcon: null,
};

const SOURCE_WINDOW_LONG_NAME: PresentableSource = {
  id: 'SOURCE_WINDOW_LONG_NAME',
  name: 'Window that has a really long name and overflows',
  isScreen: false,
  thumbnail: SOURCE_WINDOW_THUMBNAIL,
  appIcon: null,
};

export function Default(): ReactNode {
  return (
    <CallingSelectPresentingSourcesModal
      i18n={i18n}
      onSourceSelect={action('onSourceSelect')}
      onCancel={action('onCancel')}
      sources={[
        SOURCE_SCREEN,
        SOURCE_WINDOW_1,
        SOURCE_WINDOW_2,
        SOURCE_WINDOW_BROKEN,
        SOURCE_WINDOW_LONG_NAME,
      ]}
    />
  );
}
