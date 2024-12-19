// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { ProgressBar } from './ProgressBar';
import type { ComponentMeta } from '../storybook/types';

type Props = React.ComponentProps<typeof ProgressBar>;
export default {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  args: {
    fractionComplete: 0,
    isRTL: false,
  },
} satisfies ComponentMeta<Props>;

export function Spinning(args: Props): JSX.Element {
  return <ProgressBar {...args} fractionComplete={null} />;
}
export function Zero(args: Props): JSX.Element {
  return <ProgressBar {...args} />;
}

export function Thirty(args: Props): JSX.Element {
  return <ProgressBar {...args} fractionComplete={0.3} />;
}

export function Done(args: Props): JSX.Element {
  return <ProgressBar {...args} fractionComplete={1} />;
}

export function Increasing(args: Props): JSX.Element {
  const fractionComplete = useIncreasingFractionComplete();
  return <ProgressBar {...args} fractionComplete={fractionComplete} />;
}

export function RTLIncreasing(args: Props): JSX.Element {
  const fractionComplete = useIncreasingFractionComplete();
  return <ProgressBar {...args} fractionComplete={fractionComplete} isRTL />;
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
