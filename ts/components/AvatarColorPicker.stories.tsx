// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import type { PropsType } from './AvatarColorPicker';
import { AvatarColorPicker } from './AvatarColorPicker';
import { AvatarColors } from '../types/Colors';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  onColorSelected: action('onColorSelected'),
  selectedColor: overrideProps.selectedColor,
});

const story = storiesOf('Components/AvatarColorPicker', module);

story.add('Default', () => <AvatarColorPicker {...createProps()} />);

story.add('Selected', () => (
  <AvatarColorPicker
    {...createProps({
      selectedColor: AvatarColors[7],
    })}
  />
));
