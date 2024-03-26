// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { action } from '@storybook/addon-actions';
import * as React from 'react';
import enMessages from '../../_locales/en/messages.json';
import type { ComponentMeta } from '../storybook/types';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import {
  NotePreviewModal,
  type NotePreviewModalProps,
} from './NotePreviewModal';

const i18n = setupI18n('en', enMessages);

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
