// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ProfilerOnRenderCallback, ReactNode } from 'react';
import React from 'react';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('Profiler');

export type PropsType = Readonly<{
  id: string;
  children: ReactNode;
}>;

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actual,
  base,
  start,
  commit
) => {
  log.info(
    `tsx(${id}): actual=${actual.toFixed(1)}ms phase=${phase} ` +
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
