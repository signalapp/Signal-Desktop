// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { action } from '@storybook/addon-actions';
import type { ComponentMeta } from '../storybook/types.std.ts';
import type { SafetyTipsModalProps } from './SafetyTipsModal.dom.tsx';
import { SafetyTipsModal } from './SafetyTipsModal.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/SafetyTipsModal',
  component: SafetyTipsModal,
  args: {
    i18n,
    onClose: action('onClose'),
  },
} satisfies ComponentMeta<SafetyTipsModalProps>;

export function Default(args: SafetyTipsModalProps): React.JSX.Element {
  return <SafetyTipsModal {...args} />;
}
