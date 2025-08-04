// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import {
  _getAllAxoButtonVariants,
  _getAllAxoButtonSizes,
  AxoButton,
} from './AxoButton';

export default {
  title: 'Axo/AxoButton',
} satisfies Meta;

export function Basic(): JSX.Element {
  const variants = _getAllAxoButtonVariants();
  const sizes = _getAllAxoButtonSizes();
  return (
    <div className="grid gap-1">
      {sizes.map(size => {
        return (
          <div>
            <h2 className="type-title-medium">Size: {size}</h2>
            {variants.map(variant => {
              return (
                <div key={variant} className="flex gap-1">
                  <AxoButton
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                  >
                    {variant}
                  </AxoButton>

                  <AxoButton
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                    disabled
                  >
                    Disabled
                  </AxoButton>

                  <AxoButton
                    symbol="info"
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                  >
                    Icon
                  </AxoButton>

                  <AxoButton
                    symbol="info"
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                    disabled
                  >
                    Disabled
                  </AxoButton>

                  <AxoButton
                    arrow
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                  >
                    Arrow
                  </AxoButton>

                  <AxoButton
                    arrow
                    variant={variant}
                    size={size}
                    onClick={action('click')}
                    disabled
                  >
                    Disabled
                  </AxoButton>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
