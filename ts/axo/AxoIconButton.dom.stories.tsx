// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { Fragment, type JSX } from 'react';
import type { Meta } from '@storybook/react';
import { AxoIconButton } from './AxoIconButton.dom.tsx';
import type { TailwindStyles } from './tw.dom.tsx';
import { tw } from './tw.dom.tsx';

export default {
  title: 'Axo/AxoIconButton',
} satisfies Meta;

export function Basic(): JSX.Element {
  return (
    <AxoIconButton.Root
      variant="strong-secondary"
      size="lg"
      symbol="more"
      label="More actions"
    />
  );
}

const Backgrounds: Record<string, TailwindStyles> = {
  'background-primary': tw('bg-surface-primary'),
  'background-secondary': tw('bg-surface-secondary'),
  'background-overlay': tw('bg-overlay'),
  'elevated-background-primary': tw('bg-material-primary'),
  'elevated-background-secondary': tw('bg-material-secondary'),
  'elevated-background-tertiary': tw('bg-material-tertiary'),
  'elevated-background-quaternary': tw('bg-material-quaternary'),
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
                  // Translucent backgrounds need an opaque surface of the same
                  // theme behind them
                  className={tw('bg-surface-primary', Themes[row.theme])}
                  style={{
                    gridRow: rowIndex + 1,
                    gridColumn: variantIndex + 2,
                  }}
                >
                  <div
                    className={tw(
                      'size-full p-2 text-center',
                      Backgrounds[row.background]
                    )}
                  >
                    <AxoIconButton.Root
                      variant={variant}
                      size="lg"
                      symbol="lock-fill"
                      label={variant}
                    />
                  </div>
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
                    label="More actions"
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
  'pressed=false': { pressed: false },
  'pressed=true': { pressed: true },
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
                    label="More actions"
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
                    label="More actions"
                    pending
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
