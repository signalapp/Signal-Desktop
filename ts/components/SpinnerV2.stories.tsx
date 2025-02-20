// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Props } from './SpinnerV2';
import { SpinnerV2 } from './SpinnerV2';
import type { ComponentMeta } from '../storybook/types';

export default {
  title: 'Components/SpinnerV2',
  component: SpinnerV2,
  argTypes: {
    size: { control: { type: 'number' } },
  },
  args: {
    className: undefined,
    size: 16,
    strokeWidth: 3,
  },
} satisfies ComponentMeta<Props>;

export function Normal(args: Props): JSX.Element {
  return <SpinnerV2 {...args} />;
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
