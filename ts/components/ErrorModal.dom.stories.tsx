// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ErrorModal.dom.tsx';
import { ErrorModal } from './ErrorModal.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/ErrorModal',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function Normal(): JSX.Element {
  return (
    <ErrorModal
      i18n={i18n}
      onClose={action('onClose')}
      title="Real bad!"
      description="Just avoid that next time, kay?"
    />
  );
}
