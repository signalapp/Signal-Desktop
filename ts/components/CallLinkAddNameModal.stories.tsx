// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { CallLinkAddNameModalProps } from './CallLinkAddNameModal';
import { CallLinkAddNameModal } from './CallLinkAddNameModal';
import type { ComponentMeta } from '../storybook/types';
import { FAKE_CALL_LINK_WITH_ADMIN_KEY } from '../test-both/helpers/fakeCallLink';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/CallLinkAddNameModal',
  component: CallLinkAddNameModal,
  args: {
    i18n,
    callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
    onClose: action('onClose'),
    onUpdateCallLinkName: action('onUpdateCallLinkName'),
  },
} satisfies ComponentMeta<CallLinkAddNameModalProps>;

export function Basic(args: CallLinkAddNameModalProps): JSX.Element {
  return <CallLinkAddNameModal {...args} />;
}
