// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
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
} satisfies Meta<PropsType>;

export function Empty(): JSX.Element {
  return <AvatarTextEditor {...createProps()} />;
}

export function WithData(): JSX.Element {
  return (
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
}

export function WithWideCharacters(): JSX.Element {
  return (
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
}
