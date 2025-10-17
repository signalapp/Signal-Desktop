// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { type ComponentProps } from 'react';

import { action } from '@storybook/addon-actions';
import { CriticalIdlePrimaryDeviceModal } from './CriticalIdlePrimaryDeviceModal.dom.js';

const { i18n } = window.SignalContext;

type PropsType = ComponentProps<typeof CriticalIdlePrimaryDeviceModal>;
export default {
  title: 'Components/CriticalIdlePrimaryDeviceModal',
  component: CriticalIdlePrimaryDeviceModal,
  args: {
    i18n,
    onClose: action('onClose'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => (
  <CriticalIdlePrimaryDeviceModal {...args} />
);

export const Modal = Template.bind({});
Modal.args = {};
