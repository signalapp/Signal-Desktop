// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { action } from '@storybook/addon-actions';

import type { JSX } from 'react';
import type { Meta } from '@storybook/react';

import { setupI18n } from '../../util/setupI18n.dom.tsx';
import messages from '../../../_locales/en/messages.json';

import { DeleteAccountConfirmDialog } from './DeleteAccountConfirmDialog.dom.tsx';

const i18n = setupI18n('en', messages);

export default {
  component: DeleteAccountConfirmDialog,
  title: 'Components/DeleteAccountConfirmDialog',
} satisfies Meta<typeof DeleteAccountConfirmDialog>;

export function Default(): JSX.Element {
  return (
    <DeleteAccountConfirmDialog
      i18n={i18n}
      open
      onDelete={action('onDelete')}
      setClosed={action('setClosed')}
      e164="+14155550123"
    />
  );
}
