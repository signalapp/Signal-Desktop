// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { ErrorBoundary } from './ErrorBoundary';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/ErrorBoundary', module);

const Fail: React.FC<Record<string, never>> = () => {
  throw new Error('Failed');
};

story.add('Error state', () => {
  return (
    <ErrorBoundary i18n={i18n} showDebugLog={action('showDebugLog')}>
      <Fail />
    </ErrorBoundary>
  );
});
