// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import type { PropsType } from './AvatarTextEditor';
import { AvatarTextEditor } from './AvatarTextEditor';
import { AvatarColors } from '../types/Colors';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarData: overrideProps.avatarData,
  i18n,
  onCancel: action('onCancel'),
  onDone: action('onDone'),
});

export default {
  title: 'Components/AvatarTextEditor',
};

export const Empty = (): JSX.Element => <AvatarTextEditor {...createProps()} />;

export const WithData = (): JSX.Element => (
  <AvatarTextEditor
    {...createProps({
      avatarData: {
        id: '123',
        color: AvatarColors[6],
        text: 'SUP',
      },
    })}
  />
);

WithData.story = {
  name: 'with Data',
};

export const WithWideCharacters = (): JSX.Element => (
  <AvatarTextEditor
    {...createProps({
      avatarData: {
        id: '123',
        color: AvatarColors[6],
        text: '‱௸𒈙',
      },
    })}
  />
);

WithWideCharacters.story = {
  name: 'with wide characters',
};
