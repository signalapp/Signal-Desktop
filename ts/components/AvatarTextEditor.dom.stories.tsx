// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './AvatarTextEditor.dom.tsx';
import { AvatarTextEditor } from './AvatarTextEditor.dom.tsx';
import { AvatarColors } from '../types/Colors.std.ts';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarData: overrideProps.avatarData,
  i18n,
  onCancel: action('onCancel'),
  onDone: action('onDone'),
});

export default {
  title: 'Components/AvatarTextEditor',
} satisfies Meta<PropsType>;

export function Empty(): React.JSX.Element {
  return <AvatarTextEditor {...createProps()} />;
}

export function WithData(): React.JSX.Element {
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

export function WithWideCharacters(): React.JSX.Element {
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
