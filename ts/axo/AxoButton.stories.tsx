// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import {
  _getAllAxoButtonVariants,
  _getAllAxoButtonSizes,
  AxoButton,
} from './AxoButton.dom.js';
import { tw } from './tw.dom.js';

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
