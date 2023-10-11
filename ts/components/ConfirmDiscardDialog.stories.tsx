// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import type { PropsType } from './ConfirmDiscardDialog';
import { ConfirmDiscardDialog } from './ConfirmDiscardDialog';

const i18n = setupI18n('en', enMessages);

const createProps = (): PropsType => ({
  i18n,
  onClose: action('onClose'),
  onDiscard: action('onDiscard'),
});

export default {
  title: 'Components/ConfirmDiscardDialog',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return <ConfirmDiscardDialog {...createProps()} />;
}
