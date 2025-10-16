// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './ProfileNameWarningModal.dom.js';
import { ProfileNameWarningModal } from './ProfileNameWarningModal.dom.js';
import { type ComponentMeta } from '../../storybook/types.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ProfileNameWarningModal',
  component: ProfileNameWarningModal,
  args: {
    i18n,
    onClose: action('onClose'),
    conversationType: 'direct',
  },
} satisfies ComponentMeta<PropsType>;

export function Direct(args: PropsType): JSX.Element {
  return <ProfileNameWarningModal {...args} conversationType="direct" />;
}

export function Group(args: PropsType): JSX.Element {
  return <ProfileNameWarningModal {...args} conversationType="group" />;
}
