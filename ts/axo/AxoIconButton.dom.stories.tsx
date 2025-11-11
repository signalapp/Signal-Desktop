// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { Fragment } from 'react';
import type { Meta } from '@storybook/react';
import { AxoIconButton } from './AxoIconButton.dom.js';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AxoIconButton',
} satisfies Meta;

export function Basic(): JSX.Element {
  return (
    <AxoIconButton.Root
      variant="secondary"
      size="lg"
      symbol="more"
      aria-label="More"
    />
  );
}

const Backgrounds: Record<string, TailwindStyles> = {
  'background-primary': tw('bg-background-primary'),
  'background-secondary': tw('bg-background-secondary'),
  'background-overlay': tw('bg-background-overlay'),
  'elevated-background-primary': tw('bg-elevated-background-primary'),
  'elevated-background-secondary': tw('bg-elevated-background-secondary'),
  'elevated-background-tertiary': tw('bg-elevated-background-tertiary'),
  'elevated-background-quaternary': tw('bg-elevated-background-quaternary'),
};

const Themes: Record<string, TailwindStyles> = {
  light: tw('scheme-only-light'),
  dark: tw('scheme-only-dark'),
};

function getRows() {
  return Object.keys(Themes).flatMap(theme => {
    return Object.keys(Backgrounds).map(background => {
      return { theme, background };
    });
  });
}

export function Variants(): JSX.Element {
  const variants = AxoIconButton._getAllVariants();
  return (
    <div className={tw('grid min-w-full')}>
      {getRows().map((row, rowIndex) => {
        return (
          <Fragment key={rowIndex}>
            <div
              className={tw('flex items-center p-2 text-end')}
              style={{
                gridRow: rowIndex + 1,
                gridColumn: 1,
              }}
            >
              <code>
                {row.background} ({row.theme})
              </code>
            </div>
            {variants.map((variant, variantIndex) => {
              return (
                <div
                  key={variant}
                  className={tw(
                    'p-2 text-center',
                    Themes[row.theme],
                    Backgrounds[row.background]
                  )}
                  style={{
                    gridRow: rowIndex + 1,
                    gridColumn: variantIndex + 2,
                  }}
                >
                  <AxoIconButton.Root
                    variant={variant}
                    size="lg"
                    symbol="more"
                    aria-label="More"
                  />
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

export function Sizes(): JSX.Element {
  return (
    <div className={tw('grid min-w-full')}>
      {AxoIconButton._getAllSizes().map((size, sizeIndex) => {
        return (
          <Fragment key={size}>
            <div
              className={tw('flex items-center p-2 text-end')}
              style={{
                gridRow: sizeIndex + 1,
                gridColumn: 1,
              }}
            >
              <code>{size}</code>
            </div>
            {AxoIconButton._getAllVariants().map((variant, variantIndex) => {
              return (
                <div
                  key={variant}
                  className={tw('p-2 text-center')}
                  style={{
                    gridRow: sizeIndex + 1,
                    gridColumn: variantIndex + 2,
                  }}
                >
                  <AxoIconButton.Root
                    variant={variant}
                    size={size}
                    symbol="more"
                    aria-label="More"
                  />
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

const AllStates: Record<string, Partial<AxoIconButton.RootProps>> = {
  'disabled=true': { disabled: true },
  'aria-pressed=false': { 'aria-pressed': false },
  'aria-pressed=true': { 'aria-pressed': true },
};

export function States(): JSX.Element {
  return (
    <div className={tw('grid min-w-full')}>
      {Object.keys(AllStates).map((state, stateIndex) => {
        return (
          <Fragment key={stateIndex}>
            <div
              className={tw('flex items-center p-2 text-end')}
              style={{
                gridRow: stateIndex + 1,
                gridColumn: 1,
              }}
            >
              <code>{state}</code>
            </div>
            {AxoIconButton._getAllVariants().map((variant, variantIndex) => {
              return (
                <div
                  key={variant}
                  className={tw('p-2 text-center')}
                  style={{
                    gridRow: stateIndex + 1,
                    gridColumn: variantIndex + 2,
                  }}
                >
                  <AxoIconButton.Root
                    variant={variant}
                    size="lg"
                    symbol="more"
                    aria-label="More"
                    {...AllStates[state]}
                  />
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

export function Spinners(): JSX.Element {
  return (
    <div className={tw('grid min-w-full')}>
      {AxoIconButton._getAllSizes().map((size, sizeIndex) => {
        return (
          <Fragment key={size}>
            <div
              className={tw('flex items-center p-2 text-end')}
              style={{
                gridRow: sizeIndex + 1,
                gridColumn: 1,
              }}
            >
              <code>{size}</code>
            </div>
            {AxoIconButton._getAllVariants().map((variant, variantIndex) => {
              return (
                <div
                  key={variant}
                  className={tw('p-2 text-center')}
                  style={{
                    gridRow: sizeIndex + 1,
                    gridColumn: variantIndex + 2,
                  }}
                >
                  <AxoIconButton.Root
                    variant={variant}
                    size={size}
                    symbol="more"
                    aria-label="More"
                    experimentalSpinner={{ 'aria-label': 'Loading' }}
                  />
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
