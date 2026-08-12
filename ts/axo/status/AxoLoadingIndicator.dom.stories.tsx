// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoLoadingIndicator } from './AxoLoadingIndicator.dom.tsx';
import { tw } from '../tw.dom.tsx';

export default {
  title: 'Axo/Status/AxoLoadingIndicator',
} satisfies Meta;

export function Basic(): ReactNode {
  return <AxoLoadingIndicator.Root size="md" />;
}

export function Sizes(): ReactNode {
  return (
    <div className={tw('flex gap-2')}>
      <AxoLoadingIndicator.Root size="sm" />
      <AxoLoadingIndicator.Root size="md" />
      <AxoLoadingIndicator.Root size="lg" />
    </div>
  );
}

export function Weights(): ReactNode {
  return (
    <div className={tw('flex gap-2')}>
      <AxoLoadingIndicator.Root size="md" weight="thin" />
      <AxoLoadingIndicator.Root size="md" weight="light" />
      <AxoLoadingIndicator.Root size="md" weight="regular" />
      <AxoLoadingIndicator.Root size="md" weight="medium" />
    </div>
  );
}
