// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { type ComponentProps } from 'react';

import { action } from '@storybook/addon-actions';
import { TerminateGroupFailedModal } from './TerminateGroupFailedModal.dom.js';

const { i18n } = window.SignalContext;

type PropsType = ComponentProps<typeof TerminateGroupFailedModal>;

export default {
  title: 'Components/TerminateGroupFailedModal',
  component: TerminateGroupFailedModal,
  args: {
    i18n,
    onClose: action('close'),
    onRetry: action('retry'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => (
  <TerminateGroupFailedModal {...args} />
);

export const Modal = Template.bind({});
Modal.args = {};
