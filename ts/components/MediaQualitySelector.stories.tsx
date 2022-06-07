// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';

import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './MediaQualitySelector';
import { MediaQualitySelector } from './MediaQualitySelector';
import { setupI18n } from '../util/setupI18n';

export default {
  title: 'Components/MediaQualitySelector',
};

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  isHighQuality: boolean('isHighQuality', Boolean(overrideProps.isHighQuality)),
  onSelectQuality: action('onSelectQuality'),
});

export const StandardQuality = (): JSX.Element => (
  <MediaQualitySelector {...createProps()} />
);

export const HighQuality = (): JSX.Element => (
  <MediaQualitySelector
    {...createProps({
      isHighQuality: true,
    })}
  />
);
