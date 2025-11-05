// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import {
  _getAllAxoButtonVariants,
  _getAllAxoButtonSizes,
  AxoButton,
} from './AxoButton.dom.js';
import { tw } from './tw.dom.js';
import { AxoSwitch } from './AxoSwitch.dom.js';

export default {
  title: 'Axo/AxoButton',
} satisfies Meta;

export function Basic(): JSX.Element {
  const variants = _getAllAxoButtonVariants();
  const sizes = _getAllAxoButtonSizes();
  return (
    <div className={tw('grid gap-1')}>
      {sizes.map(size => {
        return (
          <div>
            <h2 className={tw('type-title-medium')}>Size: {size}</h2>
            {variants.map(variant => {
              return (
                <div key={variant} className={tw('flex gap-1')}>
                  <AxoButton.Root
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                  >
                    {variant}
                  </AxoButton.Root>

                  <AxoButton.Root
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                    disabled
                  >
                    Disabled
                  </AxoButton.Root>

                  <AxoButton.Root
                    symbol="info"
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                  >
                    Icon
                  </AxoButton.Root>

                  <AxoButton.Root
                    symbol="info"
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                    disabled
                  >
                    Disabled
                  </AxoButton.Root>

                  <AxoButton.Root
                    arrow
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                  >
                    Arrow
                  </AxoButton.Root>

                  <AxoButton.Root
                    arrow
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                    disabled
                  >
                    Disabled
                  </AxoButton.Root>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function Spinner(): JSX.Element {
  const sizes = _getAllAxoButtonSizes();
  const variants = _getAllAxoButtonVariants();

  const [loading, setLoading] = useState(true);

  function handleClick() {
    setLoading(true);
  }

  return (
    <>
      <div className={tw('mb-4 flex gap-2')}>
        <AxoSwitch.Root checked={loading} onCheckedChange={setLoading} />
        <span>Loading</span>
      </div>
      <div className={tw('flex flex-col gap-2')}>
        {sizes.map(size => {
          return (
            <div key={size} className={tw('flex gap-2')}>
              {variants.map(variant => {
                return (
                  <AxoButton.Root
                    variant={variant}
                    size={size}
                    disabled={loading}
                    experimentalSpinner={
                      loading ? { 'aria-label': 'Loading' } : null
                    }
                    onClick={handleClick}
                  >
                    Save
                  </AxoButton.Root>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

const LONG_TEXT = (
  <>
    Lorem ipsum dolor sit amet consectetur adipisicing elit. Id dicta dolorum
    magnam quibusdam nam commodi vel esse voluptatibus ut sint error consectetur
    nihil, ad, optio maiores, ipsa explicabo officiis animi.
  </>
);

function Fit(props: { longText?: boolean }) {
  return (
    <AxoButton.Root variant="primary" size="md" width="fit">
      Fit {props.longText && LONG_TEXT}
    </AxoButton.Root>
  );
}

function Grow(props: { longText?: boolean }) {
  return (
    <AxoButton.Root variant="affirmative" size="md" width="grow">
      Grow {props.longText && LONG_TEXT}
    </AxoButton.Root>
  );
}

function Full(props: { longText?: boolean }) {
  return (
    <AxoButton.Root variant="destructive" size="md" width="full">
      Fill {props.longText && LONG_TEXT}
    </AxoButton.Root>
  );
}

function WidthTestTemplate(props: {
  title: string;
  children: (children: ReactNode) => ReactNode;
}) {
  return (
    <div className={tw('space-y-2')}>
      <h2 className={tw('type-title-large')}>{props.title}</h2>

      <p>Mixed</p>
      {props.children(
        <>
          <Fit />
          <Grow />
          <Full />
        </>
      )}

      <p>Fit</p>
      {props.children(
        <>
          <Fit />
          <Fit />
          <Fit />
        </>
      )}
      <p>Fit: With long text</p>
      {props.children(
        <>
          <Fit longText />
          <Fit longText />
          <Fit longText />
        </>
      )}

      <p>Fit: With mixed length texts</p>
      {props.children(
        <>
          <Fit />
          <Fit />
          <Fit longText />
        </>
      )}

      <p>Fit</p>
      {props.children(
        <>
          <Grow />
          <Grow />
          <Grow />
        </>
      )}
      <p>Grow: With long text</p>
      {props.children(
        <>
          <Grow longText />
          <Grow longText />
          <Grow longText />
        </>
      )}

      <p>Grow: With mixed length texts</p>
      {props.children(
        <>
          <Grow />
          <Grow />
          <Grow longText />
        </>
      )}

      <p>Fill</p>
      {props.children(
        <>
          <Full />
          <Full />
          <Full />
        </>
      )}
      <p>Full: With long text</p>
      {props.children(
        <>
          <Full longText />
          <Full longText />
          <Full longText />
        </>
      )}

      <p>Full: With mixed length texts</p>
      {props.children(
        <>
          <Full />
          <Full />
          <Full longText />
        </>
      )}
    </div>
  );
}

export function WidthsTest(): JSX.Element {
  return (
    <div className={tw('space-y-16 pb-4')}>
      <WidthTestTemplate title="Block">
        {items => <div>{items}</div>}
      </WidthTestTemplate>

      <WidthTestTemplate title="Flex">
        {items => <div className={tw('flex')}>{items}</div>}
      </WidthTestTemplate>

      <WidthTestTemplate title="Flex: Wrapped">
        {items => <div className={tw('flex flex-wrap')}>{items}</div>}
      </WidthTestTemplate>

      <WidthTestTemplate title="Flex: Column">
        {items => <div className={tw('flex flex-col')}>{items}</div>}
      </WidthTestTemplate>

      <WidthTestTemplate title="Flex: Dialog footer layout">
        {items => (
          <div className={tw('flex flex-wrap')}>
            <div className={tw('ms-auto flex max-w-full flex-wrap')}>
              {items}
            </div>
          </div>
        )}
      </WidthTestTemplate>

      <WidthTestTemplate title="Grid">
        {items => <div className={tw('grid grid-cols-3')}>{items}</div>}
      </WidthTestTemplate>
    </div>
  );
}
