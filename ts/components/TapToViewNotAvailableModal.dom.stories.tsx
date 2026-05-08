// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { TapToViewNotAvailableModalProps } from './TapToViewNotAvailableModal.dom.tsx';
import {
  TapToViewNotAvailableModal,
  TapToViewNotAvailableType,
} from './TapToViewNotAvailableModal.dom.tsx';
import type { ComponentMeta } from '../storybook/types.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/TapToViewNotAvailableModal',
  component: TapToViewNotAvailableModal,
  args: {
    type: TapToViewNotAvailableType.Error,
    parameters: {
      name: 'FirstName',
    },
    i18n,
    onClose: action('onClose'),
  },
} satisfies ComponentMeta<TapToViewNotAvailableModalProps>;

export function Error(args: TapToViewNotAvailableModalProps): JSX.Element {
  return (
    <TapToViewNotAvailableModal
      {...args}
      type={TapToViewNotAvailableType.Error}
    />
  );
}

export function Expired(args: TapToViewNotAvailableModalProps): JSX.Element {
  return (
    <TapToViewNotAvailableModal
      {...args}
      type={TapToViewNotAvailableType.Expired}
    />
  );
}
