// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { ProgressCircle } from './ProgressCircle';
import type { ComponentMeta } from '../storybook/types';

type Props = React.ComponentProps<typeof ProgressCircle>;
export default {
  title: 'Components/ProgressCircle',
  component: ProgressCircle,
  args: { fractionComplete: 0, width: undefined, strokeWidth: undefined },
} satisfies ComponentMeta<Props>;

export function Zero(args: Props): JSX.Element {
  return <ProgressCircle {...args} />;
}

export function Thirty(args: Props): JSX.Element {
  return <ProgressCircle {...args} fractionComplete={0.3} />;
}

export function Done(args: Props): JSX.Element {
  return <ProgressCircle {...args} fractionComplete={1} />;
}
export function Increasing(args: Props): JSX.Element {
  const fractionComplete = useIncreasingFractionComplete();
  return <ProgressCircle {...args} fractionComplete={fractionComplete} />;
}

function useIncreasingFractionComplete() {
  const [fractionComplete, setFractionComplete] = React.useState(0);
  React.useEffect(() => {
    if (fractionComplete >= 1) {
      return;
    }
    const timeout = setTimeout(() => {
      setFractionComplete(cur => Math.min(1, cur + 0.1));
    }, 300);
    return () => clearTimeout(timeout);
  }, [fractionComplete]);
  return fractionComplete;
}
