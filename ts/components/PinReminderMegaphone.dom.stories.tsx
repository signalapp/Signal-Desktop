// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './PinReminderMegaphone.dom.tsx';
import { PinReminderMegaphone } from './PinReminderMegaphone.dom.tsx';
import { type ComponentMeta } from '../storybook/types.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/PinReminderMegaphone',
  component: PinReminderMegaphone,
  argTypes: {
    isFullSize: {
      control: { type: 'boolean' },
    },
  },
  args: {
    i18n,
    isFullSize: true,
    onClickNarrowMegaphone: action('onClickNarrowMegaphone'),
    onDismiss: action('onDismiss'),
    onShowModal: action('onShowModal'),
  },
} satisfies ComponentMeta<PropsType>;

export function Defaults(args: PropsType): JSX.Element {
  return <PinReminderMegaphone {...args} />;
}
