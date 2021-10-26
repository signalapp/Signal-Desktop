// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';

import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './MediaQualitySelector';
import { MediaQualitySelector } from './MediaQualitySelector';
import { setupI18n } from '../util/setupI18n';

const story = storiesOf('Components/MediaQualitySelector', module);

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  isHighQuality: boolean('isHighQuality', Boolean(overrideProps.isHighQuality)),
  onSelectQuality: action('onSelectQuality'),
});

story.add('Standard Quality', () => (
  <MediaQualitySelector {...createProps()} />
));

story.add('High Quality', () => (
  <MediaQualitySelector
    {...createProps({
      isHighQuality: true,
    })}
  />
));
