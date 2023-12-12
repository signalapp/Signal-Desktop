// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './WhatsNewModal';
import { WhatsNewModal } from './WhatsNewModal';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/WhatsNewModal',
} satisfies Meta<PropsType>;

const getDefaultProps = (): PropsType => ({
  hideWhatsNewModal: action('hideWhatsNewModal'),
  i18n,
});

export function Modal(): JSX.Element {
  return <WhatsNewModal {...getDefaultProps()} />;
}
