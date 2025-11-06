// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// STUB: Badge UI component - Badges feature removed in Orbital cleanup

import { memo } from 'react';
import type { FC } from 'react';

const Namespace = 'AxoBadge';

export namespace ExperimentalAxoBadge {
  export type Size = 'sm' | 'md';

  export type RootProps = Readonly<{
    size: Size;
    value?: number;
    max?: number;
    maxDisplay?: number;
    'aria-label'?: string;
  }>;

  export const Root: FC<RootProps> = memo(_props => {
    // Stub: Return null since badges are disabled
    return null;
  });

  Root.displayName = `${Namespace}.Root`;
}
