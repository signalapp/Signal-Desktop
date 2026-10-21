// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { ProgressModal } from './ProgressModal.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/ProgressModal',
} satisfies Meta;

export function Default(): ReactNode {
  return <ProgressModal i18n={i18n} />;
}

export function WithDescription(): ReactNode {
  return (
    <ProgressModal
      i18n={i18n}
      description={i18n('icu:GroupV2--terminate-group-in-progress')}
    />
  );
}
