// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { action } from '@storybook/addon-actions';
import * as React from 'react';
import type { ComponentMeta } from '../storybook/types.std.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import {
  NotePreviewModal,
  type NotePreviewModalProps,
} from './NotePreviewModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/NotePreviewModal',
  component: NotePreviewModal,
  argTypes: {},
  args: {
    conversation: getDefaultConversation({
      note: 'Met at UC Berkeley, mutual friends with Katie Hall.\n\nWebsite: https://example.com/',
    }),
    i18n,
    onClose: action('onClose'),
    onEdit: action('onEdit'),
  },
} satisfies ComponentMeta<NotePreviewModalProps>;

export function Normal(args: NotePreviewModalProps): JSX.Element {
  return <NotePreviewModal {...args} />;
}
