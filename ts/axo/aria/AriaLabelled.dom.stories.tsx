// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import type { ReactNode } from 'react';
import { AriaLabelled } from './AriaLabelled.dom.tsx';
import { tw } from '../tw.dom.tsx';

export default {
  title: 'Axo/Aria/AriaLabelled',
} satisfies Meta;

export function Basic(): ReactNode {
  return (
    <AriaLabelled.Root asChild>
      <div role="figure">
        <AriaLabelled.Label>Label</AriaLabelled.Label>
        <AriaLabelled.Description>Description</AriaLabelled.Description>
      </div>
    </AriaLabelled.Root>
  );
}

export function AsChild(): ReactNode {
  return (
    <AriaLabelled.Root asChild>
      <div role="figure">
        <AriaLabelled.Label asChild>
          <div className={tw('type-body-medium font-semibold')}>Label</div>
        </AriaLabelled.Label>
        <AriaLabelled.Description asChild>
          <div className={tw('type-caption text-secondary')}>Description</div>
        </AriaLabelled.Description>
      </div>
    </AriaLabelled.Root>
  );
}
