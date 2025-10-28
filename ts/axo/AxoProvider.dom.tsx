// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import React, { memo } from 'react';
import { Direction } from 'radix-ui';

type AxoProviderProps = Readonly<{
  dir: 'ltr' | 'rtl';
  children: ReactNode;
}>;

export const AxoProvider: FC<AxoProviderProps> = memo(props => {
  return (
    <Direction.Provider dir={props.dir}>{props.children}</Direction.Provider>
  );
});

AxoProvider.displayName = 'AxoProvider';
