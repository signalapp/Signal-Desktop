// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { MediaQualitySelectorProps } from './MediaQualitySelector.dom.tsx';
import { MediaQualitySelector } from './MediaQualitySelector.dom.tsx';

export default {
  title: 'Components/MediaQualitySelector',
  argTypes: {},
  args: {},
} satisfies Meta<MediaQualitySelectorProps>;

const { i18n } = window.SignalContext;

const createProps = (
  overrideProps: Partial<MediaQualitySelectorProps> = {}
): MediaQualitySelectorProps => ({
  conversationId: 'abc123',
  i18n,
  isHighQuality: overrideProps.isHighQuality ?? false,
  onSelectQuality: action('onSelectQuality'),
});

export function StandardQuality(): JSX.Element {
  return <MediaQualitySelector {...createProps()} />;
}

export function HighQuality(): JSX.Element {
  return (
    <MediaQualitySelector
      {...createProps({
        isHighQuality: true,
      })}
    />
  );
}
