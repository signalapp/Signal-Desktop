// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { CallLinkEditModalProps } from './CallLinkEditModal';
import { CallLinkEditModal } from './CallLinkEditModal';
import type { ComponentMeta } from '../storybook/types';
import { FAKE_CALL_LINK_WITH_ADMIN_KEY } from '../test-both/helpers/fakeCallLink';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/CallLinkEditModal',
  component: CallLinkEditModal,
  args: {
    i18n,
    callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
    hasActiveCall: false,
    onClose: action('onClose'),
    onCopyCallLink: action('onCopyCallLink'),
    onOpenCallLinkAddNameModal: action('onOpenCallLinkAddNameModal'),
    onUpdateCallLinkRestrictions: action('onUpdateCallLinkRestrictions'),
    onShareCallLinkViaSignal: action('onShareCallLinkViaSignal'),
    onStartCallLinkLobby: action('onStartCallLinkLobby'),
  },
} satisfies ComponentMeta<CallLinkEditModalProps>;

export function Basic(args: CallLinkEditModalProps): JSX.Element {
  return <CallLinkEditModal {...args} />;
}

export function InAnotherCall(args: CallLinkEditModalProps): JSX.Element {
  return <CallLinkEditModal {...args} hasActiveCall />;
}
