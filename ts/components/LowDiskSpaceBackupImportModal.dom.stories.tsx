// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { type ComponentProps } from 'react';

import { action } from '@storybook/addon-actions';
import { LowDiskSpaceBackupImportModal } from './LowDiskSpaceBackupImportModal.dom.js';
import { MEBIBYTE } from '../types/AttachmentSize.std.js';

const { i18n } = window.SignalContext;

type PropsType = ComponentProps<typeof LowDiskSpaceBackupImportModal>;

export default {
  title: 'Components/LowDiskSpaceBackupImportModal',
  component: LowDiskSpaceBackupImportModal,
  args: {
    i18n,
    onClose: action('close'),
    bytesNeeded: 1540 * MEBIBYTE,
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => (
  <LowDiskSpaceBackupImportModal {...args} />
);

export const Modal = Template.bind({});
Modal.args = {};
