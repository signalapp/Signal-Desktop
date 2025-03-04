// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './TapToViewNotAvailableModal';
import {
  TapToViewNotAvailableModal,
  TapToViewNotAvailableType,
} from './TapToViewNotAvailableModal';
import type { ComponentMeta } from '../storybook/types';

const i18n = setupI18n('en', enMessages);

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
} satisfies ComponentMeta<PropsType>;

export function Error(args: PropsType): JSX.Element {
  return (
    <TapToViewNotAvailableModal
      {...args}
      type={TapToViewNotAvailableType.Error}
    />
  );
}

export function Expired(args: PropsType): JSX.Element {
  return (
    <TapToViewNotAvailableModal
      {...args}
      type={TapToViewNotAvailableType.Expired}
    />
  );
}
