// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { SpinnerV2 } from './SpinnerV2';

import type { ComponentMeta } from '../storybook/types';
import type { Props } from './SpinnerV2';

export default {
  title: 'Components/SpinnerV2',
  component: SpinnerV2,
  argTypes: {
    size: { control: { type: 'number' } },
    strokeWidth: { control: { type: 'number' } },
    marginRatio: { control: { type: 'number' } },
  },
  args: { size: 36, strokeWidth: 2, className: undefined, marginRatio: 0.8 },
} satisfies ComponentMeta<Props>;

export function Default(args: Props): JSX.Element {
  return <SpinnerV2 {...args} />;
}

export function Thin(args: Props): JSX.Element {
  return <SpinnerV2 {...args} strokeWidth={1} />;
}

export function Thick(args: Props): JSX.Element {
  return <SpinnerV2 {...args} strokeWidth={6} />;
}

export function NoMargin(args: Props): JSX.Element {
  return <SpinnerV2 {...args} marginRatio={1} strokeWidth={6} />;
}

export function BigMargin(args: Props): JSX.Element {
  return <SpinnerV2 {...args} marginRatio={0.5} strokeWidth={6} />;
}

export function Styled(args: Props): JSX.Element {
  return (
    <div>
      <style>{`
        .red-spinner {
          color: light-dark(hsl(0deg 100% 70%), hsl(0deg 100% 30%));
        }
      `}</style>
      <SpinnerV2 {...args} className="red-spinner" />
    </div>
  );
}
