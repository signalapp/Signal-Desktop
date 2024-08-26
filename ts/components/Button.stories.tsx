// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './Button';
import { Button, ButtonSize, ButtonVariant } from './Button';

export default {
  title: 'Components/Button',
} satisfies Meta<PropsType>;

export function KitchenSink(): JSX.Element {
  return (
    <>
      {Object.values(ButtonVariant).map(variant => (
        <React.Fragment key={variant}>
          {[ButtonSize.Large, ButtonSize.Medium, ButtonSize.Small].map(size => (
            <React.Fragment key={size}>
              <p>
                <Button
                  onClick={action('onClick')}
                  size={size}
                  variant={variant}
                >
                  {variant}
                </Button>
              </p>
              <p>
                <Button
                  disabled
                  onClick={action('onClick')}
                  size={size}
                  variant={variant}
                >
                  {variant}
                </Button>
              </p>
              <p>
                <Button
                  discouraged
                  onClick={action('onClick')}
                  size={size}
                  variant={variant}
                >
                  {variant}
                </Button>
              </p>
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

export function AriaLabel(): JSX.Element {
  return (
    <Button
      aria-label="hello"
      className="module-ForwardMessageModal__header--back"
      onClick={action('onClick')}
    />
  );
}

export function CustomStyles(): JSX.Element {
  return (
    <Button onClick={action('onClick')} style={{ transform: 'rotate(5deg)' }}>
      Hello world
    </Button>
  );
}
