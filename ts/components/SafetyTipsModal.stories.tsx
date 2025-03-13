// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { action } from '@storybook/addon-actions';
import type { ComponentMeta } from '../storybook/types';
import type { SafetyTipsModalProps } from './SafetyTipsModal';
import { SafetyTipsModal } from './SafetyTipsModal';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/SafetyTipsModal',
  component: SafetyTipsModal,
  args: {
    i18n,
    onClose: action('onClose'),
  },
} satisfies ComponentMeta<SafetyTipsModalProps>;

export function Default(args: SafetyTipsModalProps): JSX.Element {
  return <SafetyTipsModal {...args} />;
}
