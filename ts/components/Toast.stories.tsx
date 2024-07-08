// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './Toast';
import { Toast } from './Toast';
import { type ComponentMeta, argPresets } from '../storybook/types';

export default {
  title: 'Components/Toast',
  component: Toast,
  argTypes: {
    autoDismissDisabled: { control: { type: 'boolean' } },
    className: { control: { type: 'text' } },
    children: { control: { type: 'text' } },
    timeout: argPresets({
      '1s': 1000,
      '30s': 30_000,
    }),
    toastAction: argPresets({
      None: undefined,
      Dismiss: { label: 'Dismiss', onClick: action('onClick') },
      Undo: { label: 'Undo', onClick: action('onClick') },
    }),
  },
  args: {
    autoDismissDisabled: undefined,
    className: undefined,
    children: 'This is a toast',
    disableCloseOnClick: undefined,
    onClose: action('onClose'),
    style: undefined,
    timeout: undefined,
    toastAction: undefined,
  },
} satisfies ComponentMeta<PropsType>;

export function Defaults(args: PropsType): JSX.Element {
  return <Toast {...args} />;
}

export function Long(args: PropsType): JSX.Element {
  return (
    <Toast {...args}>
      Lorem ipsum dolor sit amet, consectetur adipisicing elit. Debitis deserunt
      cupiditate doloribus vitae perspiciatis, eos atque mollitia aliquam quae
      aspernatur et iure vero illo veritatis quibusdam maiores laborum.
      Inventore, minus.
    </Toast>
  );
}
