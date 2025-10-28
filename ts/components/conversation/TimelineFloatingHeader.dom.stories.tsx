// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './TimelineFloatingHeader.dom.js';
import { TimelineFloatingHeader } from './TimelineFloatingHeader.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/TimelineFloatingHeader',
  argTypes: {
    isLoading: { control: { type: 'boolean' } },
    visible: { control: { type: 'boolean' } },
  },
  args: {
    isLoading: false,
    visible: false,
    i18n,
    timestamp: Date.now(),
  },
} satisfies Meta<PropsType>;

export function Default(args: PropsType): JSX.Element {
  return <TimelineFloatingHeader {...args} />;
}

export function Visible(args: PropsType): JSX.Element {
  return <TimelineFloatingHeader {...args} visible />;
}

export function Loading(args: PropsType): JSX.Element {
  return <TimelineFloatingHeader {...args} visible isLoading />;
}
