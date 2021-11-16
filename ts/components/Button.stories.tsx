// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { Button, ButtonSize, ButtonVariant } from './Button';

const story = storiesOf('Components/Button', module);

story.add('Kitchen sink', () => (
  <>
    {Object.values(ButtonVariant).map(variant => (
      <React.Fragment key={variant}>
        {[ButtonSize.Large, ButtonSize.Medium, ButtonSize.Small].map(size => (
          <React.Fragment key={size}>
            <p>
              <Button onClick={action('onClick')} size={size} variant={variant}>
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
          </React.Fragment>
        ))}
      </React.Fragment>
    ))}
  </>
));

story.add('aria-label', () => (
  <Button
    aria-label="hello"
    className="module-ForwardMessageModal__header--back"
    onClick={action('onClick')}
  />
));

story.add('Custom styles', () => (
  <Button onClick={action('onClick')} style={{ transform: 'rotate(5deg)' }}>
    Hello world
  </Button>
));
