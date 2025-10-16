// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { CallLinkAddNameModalProps } from './CallLinkAddNameModal.dom.js';
import { CallLinkAddNameModal } from './CallLinkAddNameModal.dom.js';
import type { ComponentMeta } from '../storybook/types.std.js';
import { FAKE_CALL_LINK_WITH_ADMIN_KEY } from '../test-helpers/fakeCallLink.std.js';

const { i18n } = window.SignalContext;

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
