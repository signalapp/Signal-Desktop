// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React from 'react';
import type { Meta } from '@storybook/react';
import { AxoScrollArea } from './AxoScrollArea.dom.js';
import { tw } from './tw.dom.js';
import { AxoSymbol } from './AxoSymbol.dom.js';

export default {
  title: 'Axo/AxoScrollArea',
} satisfies Meta;

function Box(props: { children: ReactNode }) {
  return (
    <div
      className={tw(
        'flex items-center justify-center rounded-2xl bg-color-fill-primary p-10 type-title-large font-semibold text-label-primary-on-color'
      )}
    >
      {props.children}
    </div>
  );
}

function MaybeMask(props: { mask?: boolean; children: ReactNode }) {
  if (props.mask) {
    return <AxoScrollArea.Mask>{props.children}</AxoScrollArea.Mask>;
  }

  return <>{props.children}</>;
}

function VerticalTemplate(props: {
  items: number;
  centered?: boolean;
  fit?: boolean;
  hints?: boolean;
  mask?: boolean;
}) {
  return (
    <div className={tw('w-64 rounded-2xl bg-background-secondary')}>
      <h1 className={tw('px-3 pt-3 pb-2 type-title-large')}>Header</h1>
      <div className={tw(props.fit || 'h-100')}>
        <AxoScrollArea.Root
          scrollbarWidth="thin"
          maxHeight={props.fit ? 400 : undefined}
        >
          {props.hints && <AxoScrollArea.Hint edge="top" />}
          {props.hints && <AxoScrollArea.Hint edge="bottom" />}
          <MaybeMask mask={props.mask}>
            <AxoScrollArea.Viewport>
              <AxoScrollArea.Content>
                <div
                  className={tw(
                    'flex flex-col gap-2',
                    props.centered && 'min-h-full justify-center'
                  )}
                >
                  {Array.from({ length: props.items }, (_, index) => {
                    return <Box key={index}>{index + 1}</Box>;
                  })}
                </div>
              </AxoScrollArea.Content>
            </AxoScrollArea.Viewport>
          </MaybeMask>
        </AxoScrollArea.Root>
      </div>
      <p className={tw('px-3 pt-2 pb-3 type-title-large')}>Footer</p>
    </div>
  );
}

function VerticalVariants(props: { mask?: boolean; hints?: boolean }) {
  return (
    <div className={tw('flex w-fit flex-row gap-2')}>
      <VerticalTemplate {...props} items={10} />
      <VerticalTemplate {...props} items={10} centered />
      <VerticalTemplate {...props} items={10} fit />
      <VerticalTemplate {...props} items={2} />
      <VerticalTemplate {...props} items={2} centered />
      <VerticalTemplate {...props} items={2} fit />
      <VerticalTemplate {...props} items={0} />
      <VerticalTemplate {...props} items={0} centered />
      <VerticalTemplate {...props} items={0} fit />
    </div>
  );
}

export function Vertical(): JSX.Element {
  return <VerticalVariants />;
}

export function VerticalWithHints(): JSX.Element {
  return <VerticalVariants hints />;
}

export function VerticalWithMask(): JSX.Element {
  return <VerticalVariants mask />;
}

function HorizontalTemplate(props: {
  items: number;
  centered?: boolean;
  fit?: boolean;
  hints?: boolean;
  mask?: boolean;
}) {
  return (
    <div
      className={tw(
        'flex h-32 w-fit flex-row rounded-2xl bg-background-secondary'
      )}
    >
      <div className={tw('flex flex-col justify-center p-4')}>
        <AxoSymbol.Icon label={null} symbol="arrow-[start]" size={24} />
      </div>
      <div className={tw(props.fit || 'w-100')}>
        <AxoScrollArea.Root
          orientation="horizontal"
          scrollbarWidth="thin"
          maxWidth={props.fit ? 400 : undefined}
        >
          {props.hints && <AxoScrollArea.Hint edge="inline-start" />}
          {props.hints && <AxoScrollArea.Hint edge="inline-end" />}
          <MaybeMask mask={props.mask}>
            <AxoScrollArea.Viewport>
              <AxoScrollArea.Content>
                <div
                  className={tw(
                    'flex h-full flex-row items-stretch gap-2',
                    props.centered && 'justify-center-safe'
                  )}
                >
                  {Array.from({ length: props.items }, (_, index) => {
                    return <Box key={index}>{index + 1}</Box>;
                  })}
                </div>
              </AxoScrollArea.Content>
            </AxoScrollArea.Viewport>
          </MaybeMask>
        </AxoScrollArea.Root>
      </div>
      <div className={tw('flex flex-col justify-center p-4')}>
        <AxoSymbol.Icon label={null} symbol="arrow-[end]" size={24} />
      </div>
    </div>
  );
}

function HorizontalVariants(props: { mask?: boolean; hints?: boolean }) {
  return (
    <div className={tw('flex flex-col gap-2')}>
      <HorizontalTemplate {...props} items={10} />
      <HorizontalTemplate {...props} items={10} centered />
      <HorizontalTemplate {...props} items={10} fit />
      <HorizontalTemplate {...props} items={2} />
      <HorizontalTemplate {...props} items={2} centered />
      <HorizontalTemplate {...props} items={2} fit />
      <HorizontalTemplate {...props} items={0} />
    </div>
  );
}

export function Horizontal(): JSX.Element {
  return <HorizontalVariants />;
}

export function HorizontalWithHints(): JSX.Element {
  return <HorizontalVariants hints />;
}

export function HorizontalWithMask(): JSX.Element {
  return <HorizontalVariants mask />;
}

function BothTemplate(props: {
  cols: number;
  rows: number;
  centered?: boolean;
  fit?: boolean;
  hints?: boolean;
  mask?: boolean;
}) {
  return (
    <div
      className={tw(
        props.fit || 'size-100',
        'rounded-lg bg-background-secondary'
      )}
    >
      <AxoScrollArea.Root
        orientation="both"
        scrollbarWidth="thin"
        scrollbarGutter="stable-both-edges"
        maxWidth={props.fit ? 400 : undefined}
        maxHeight={props.fit ? 400 : undefined}
      >
        {props.hints && <AxoScrollArea.Hint edge="top" />}
        {props.hints && <AxoScrollArea.Hint edge="bottom" />}
        {props.hints && <AxoScrollArea.Hint edge="inline-start" />}
        {props.hints && <AxoScrollArea.Hint edge="inline-end" />}
        <MaybeMask mask={props.mask}>
          <AxoScrollArea.Viewport>
            <AxoScrollArea.Content>
              <div
                className={tw(
                  'flex flex-col gap-2',
                  props.centered && 'min-h-full justify-center'
                )}
              >
                {Array.from({ length: props.rows }, (_, row) => {
                  return (
                    <div
                      key={row}
                      className={tw(
                        'flex flex-row gap-2',
                        props.centered && 'justify-center'
                      )}
                    >
                      {Array.from({ length: props.cols }, (_2, col) => {
                        return <Box key={col}>{col + 1}</Box>;
                      })}
                    </div>
                  );
                })}
              </div>
            </AxoScrollArea.Content>
          </AxoScrollArea.Viewport>
        </MaybeMask>
      </AxoScrollArea.Root>
    </div>
  );
}

function BothVariants(props: { mask?: boolean; hints?: boolean }) {
  return (
    <div className={tw('flex flex-col items-start justify-start gap-2')}>
      <BothTemplate {...props} cols={10} rows={10} />
      <BothTemplate {...props} cols={10} rows={10} centered />
      <BothTemplate {...props} cols={10} rows={10} fit />
      <BothTemplate {...props} cols={2} rows={2} />
      <BothTemplate {...props} cols={2} rows={2} centered />
      <BothTemplate {...props} cols={2} rows={2} fit />
      <BothTemplate {...props} cols={0} rows={0} />
      <BothTemplate {...props} cols={0} rows={0} centered />
      <BothTemplate {...props} cols={0} rows={0} fit />
    </div>
  );
}

export function Both(): JSX.Element {
  return <BothVariants />;
}

export function BothWithHints(): JSX.Element {
  return <BothVariants hints />;
}

export function BothWithMask(): JSX.Element {
  return <BothVariants mask />;
}
