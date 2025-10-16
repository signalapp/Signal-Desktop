// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DebugLogErrorModal.dom.js';
import { DebugLogErrorModal } from './DebugLogErrorModal.dom.js';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  description: overrideProps.description ?? '',
  i18n,
  onClose: action('onClick'),
  onSubmitDebugLog: action('onSubmitDebugLog'),
});

export default {
  title: 'Components/DebugLogErrorModal',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return <DebugLogErrorModal {...createProps()} />;
}

export function Donations(): JSX.Element {
  return (
    <DebugLogErrorModal
      {...createProps({
        description:
          'Try again or submit a debug log to Support for help completing your donation. Debug logs helps us diagnose and fix the issue, and do not contain identifying information.',
      })}
    />
  );
}
