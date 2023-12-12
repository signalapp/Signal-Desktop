// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './MediaQualitySelector';
import { MediaQualitySelector } from './MediaQualitySelector';
import { setupI18n } from '../util/setupI18n';

export default {
  title: 'Components/MediaQualitySelector',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
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
