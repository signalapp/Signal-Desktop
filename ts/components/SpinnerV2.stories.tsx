// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';

import { SpinnerV2 } from './SpinnerV2.dom.js';
import { tw } from '../axo/tw.dom.js';

import type { ComponentMeta } from '../storybook/types.std.js';
import type { Props } from './SpinnerV2.dom.js';

export default {
  title: 'Components/SpinnerV2',
  component: SpinnerV2,
  argTypes: {
    variant: {
      options: ['normal', 'no-background', 'no-background-incoming', 'brand'],
      control: { type: 'select' },
    },
    size: { control: { type: 'number' } },
    value: { control: { type: 'range', min: 0, max: 1, step: 0.1 } },
    strokeWidth: { control: { type: 'number' } },
    marginRatio: { control: { type: 'number' } },
  },
  args: {
    size: 36,
    strokeWidth: 2,
    marginRatio: 0.8,
    min: 0,
    max: 1,
    value: undefined,
    variant: 'normal',
    ariaLabel: 'label',
  },
} satisfies ComponentMeta<Props>;

export function Default(args: Props): JSX.Element {
  return (
    <div className={tw('bg-background-overlay')}>
      <SpinnerV2 {...args} />
    </div>
  );
}

export function Thin(args: Props): JSX.Element {
  return (
    <div className={tw('bg-background-overlay')}>
      <SpinnerV2 {...args} strokeWidth={1} />
    </div>
  );
}

export function Thick(args: Props): JSX.Element {
  return (
    <div className={tw('bg-background-overlay')}>
      <SpinnerV2 {...args} strokeWidth={6} />
    </div>
  );
}

export function NoMargin(args: Props): JSX.Element {
  return (
    <div className={tw('bg-background-overlay')}>
      <SpinnerV2 {...args} marginRatio={1} strokeWidth={6} />
    </div>
  );
}

export function BigMargin(args: Props): JSX.Element {
  return (
    <div className={tw('bg-background-overlay')}>
      <SpinnerV2 {...args} marginRatio={0.5} strokeWidth={6} />
    </div>
  );
}

export function SpinnerToProgress(args: Props): JSX.Element {
  const [value, setValue] = useState<number | undefined>();
  useEffect(() => {
    const timer = setInterval(() => {
      setValue(v => {
        if (v == null) {
          return 0.3;
        }
        return undefined;
      });
    }, 2000);
    return () => {
      clearInterval(timer);
    };
  });
  return (
    <div className={tw('bg-background-overlay')}>
      <SpinnerV2 {...args} value={value} />
    </div>
  );
}
