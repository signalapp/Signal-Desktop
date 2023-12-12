// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './ErrorBoundary';
import { ErrorBoundary } from './ErrorBoundary';

const i18n = setupI18n('en', enMessages);

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
