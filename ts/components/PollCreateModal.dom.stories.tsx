// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PollCreateModalProps } from './PollCreateModal.dom.js';
import { PollCreateModal } from './PollCreateModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/PollCreateModal',
} satisfies Meta<PollCreateModalProps>;

const onClose = action('onClose');
const onSendPoll = action('onSendPoll');

export function Default(): JSX.Element {
  return (
    <PollCreateModal i18n={i18n} onClose={onClose} onSendPoll={onSendPoll} />
  );
}
