// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './LocalDeleteWarningModal.dom.js';
import { LocalDeleteWarningModal } from './LocalDeleteWarningModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/LocalDeleteWarningModal',
  component: LocalDeleteWarningModal,
  args: {
    i18n,
    onClose: action('onClose'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => (
  <LocalDeleteWarningModal {...args} />
);

export const Modal = Template.bind({});
Modal.args = {};
