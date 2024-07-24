// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

import React from 'react';

export abstract class PureComponentProfiler<
  Props extends Record<string, unknown>,
  State extends Record<string, unknown>,
> extends React.Component<Props, State> {
  public override shouldComponentUpdate(
    nextProps: Props,
    nextState: State
  ): boolean {
    console.group(`PureComponentProfiler(${this.props.id})`);

    const propKeys = new Set([
      ...Object.keys(nextProps),
      ...Object.keys(this.props),
    ]);

    const stateKeys = new Set([
      ...Object.keys(nextState ?? {}),
      ...Object.keys(this.state ?? {}),
    ]);

    let result = false;
    for (const key of propKeys) {
      if (nextProps[key] !== this.props[key]) {
        console.error(
          `propUpdated(${key})`,
          this.props[key],
          '=>',
          nextProps[key]
        );
        result = true;
      }
    }
    for (const key of stateKeys) {
      if (nextState[key] !== this.state[key]) {
        console.error(
          `stateUpdated(${key}):`,
          this.state[key],
          '=>',
          nextState[key]
        );
        result = true;
      }
    }

    console.groupEnd();

    return result;
  }
}
