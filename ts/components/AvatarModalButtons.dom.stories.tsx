// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './AvatarModalButtons.dom.js';
import { AvatarModalButtons } from './AvatarModalButtons.dom.js';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  hasChanges: Boolean(overrideProps.hasChanges),
  i18n,
  onCancel: action('onCancel'),
  onSave: action('onSave'),
});

export default {
  title: 'Components/AvatarModalButtons',
} satisfies Meta<PropsType>;

export function HasChanges(): JSX.Element {
  return (
    <AvatarModalButtons
      {...createProps({
        hasChanges: true,
      })}
    />
  );
}

export function NoChanges(): JSX.Element {
  return <AvatarModalButtons {...createProps()} />;
}
