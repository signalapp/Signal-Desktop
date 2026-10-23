// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoBrand } from './AxoBrand.dom.tsx';
import { AxoTheme } from './AxoTheme.dom.tsx';
import { tw } from './tw.dom.tsx';

export default {
  title: 'Axo/AxoBrand',
} satisfies Meta;

export function LogoAndWordMark(): ReactNode {
  return (
    <div className={tw('flex flex-col gap-4')}>
      <AxoTheme.Override theme="force-light">
        <div className={tw('bg-surface-primary p-4')}>
          <AxoBrand.LogoAndWordMark maxWidth={200} />
        </div>
      </AxoTheme.Override>
      <AxoTheme.Override theme="force-dark">
        <div className={tw('bg-surface-primary p-4')}>
          <AxoBrand.LogoAndWordMark maxWidth={200} />
        </div>
      </AxoTheme.Override>
    </div>
  );
}
