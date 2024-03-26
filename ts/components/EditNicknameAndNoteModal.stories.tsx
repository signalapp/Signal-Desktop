// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { action } from '@storybook/addon-actions';
import * as React from 'react';
import enMessages from '../../_locales/en/messages.json';
import type { ComponentMeta } from '../storybook/types';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import type { EditNicknameAndNoteModalProps } from './EditNicknameAndNoteModal';
import { EditNicknameAndNoteModal } from './EditNicknameAndNoteModal';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/EditNicknameAndNoteModal',
  component: EditNicknameAndNoteModal,
  argTypes: {},
  args: {
    conversation: getDefaultConversation({
      nicknameGivenName: 'Bestie',
      nicknameFamilyName: 'McBesterson',
      note: 'Met at UC Berkeley, mutual friends with Katie Hall.\n\nWebsite: https://example.com/',
    }),
    i18n,
    onClose: action('onClose'),
    onSave: action('onSave'),
  },
} satisfies ComponentMeta<EditNicknameAndNoteModalProps>;

export function Normal(args: EditNicknameAndNoteModalProps): JSX.Element {
  return <EditNicknameAndNoteModal {...args} />;
}
