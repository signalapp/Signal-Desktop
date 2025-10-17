// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ErrorBoundary.dom.js';
import { ErrorBoundary } from './ErrorBoundary.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ErrorBoundary',
} satisfies Meta<Props>;

const Fail: React.FC<Record<string, never>> = () => {
  throw new Error('Failed');
};

export function ErrorState(): JSX.Element {
  return (
    <ErrorBoundary i18n={i18n} showDebugLog={action('showDebugLog')}>
      <Fail />
    </ErrorBoundary>
  );
}
