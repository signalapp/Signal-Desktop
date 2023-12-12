// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import * as log from '../logging/log';

type InternalPropsType = Readonly<{
  id: string;
  children: ReactNode;

  onRender(
    id: string,
    phase: 'mount' | 'update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number,
    interactions: Set<unknown>
  ): void;
}>;

export type PropsType = Readonly<{
  id: string;
  children: ReactNode;
}>;

const onRender: InternalPropsType['onRender'] = (
  id,
  phase,
  actual,
  base,
  start,
  commit
) => {
  log.info(
    `Profiler.tsx(${id}): actual=${actual.toFixed(1)}ms phase=${phase} ` +
      `base=${base.toFixed(1)}ms start=${start.toFixed(1)}ms ` +
      `commit=${commit.toFixed(1)}ms`
  );
};

export function Profiler({ id, children }: PropsType): JSX.Element {
  return (
    <React.Profiler id={id} onRender={onRender}>
      {children}
    </React.Profiler>
  );
}
