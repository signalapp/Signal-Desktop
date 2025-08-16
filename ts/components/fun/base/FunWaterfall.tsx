// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, ReactNode } from 'react';
import React from 'react';

/**
 * Components
 */

export type FunWaterfallContainerProps = Readonly<{
  totalSize: number;
  children: ReactNode;
}>;

export function FunWaterfallContainer(
  props: FunWaterfallContainerProps
): JSX.Element {
  return (
    <div
      className="FunWaterfall__Container"
      style={
        {
          '--fun-waterfall-container-total-size': `${props.totalSize}px`,
        } as CSSProperties
      }
    >
      {props.children}
    </div>
  );
}

export type FunWaterfallItemProps = Readonly<{
  'data-key': string;
  width: number;
  height: number;
  offsetY: number;
  offsetX: number;
  children: ReactNode;
}>;

export function FunWaterfallItem(props: FunWaterfallItemProps): JSX.Element {
  return (
    <div
      data-key={props['data-key']}
      className="FunWaterfall__Item"
      style={
        {
          '--fun-waterfall-item-width': `${props.width}px`,
          '--fun-waterfall-item-height': `${props.height}px`,
          '--fun-waterfall-item-offset-x': `${props.offsetX}px`,
          '--fun-waterfall-item-offset-y': `${props.offsetY}px`,
        } as CSSProperties
      }
    >
      {props.children}
    </div>
  );
}
