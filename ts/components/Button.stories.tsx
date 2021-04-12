// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { Button, ButtonVariant } from './Button';

const story = storiesOf('Components/Button', module);

story.add('Kitchen sink', () => (
  <>
    <p>
      <Button onClick={action('onClick')} variant={ButtonVariant.Primary}>
        Hello world
      </Button>
    </p>
    <p>
      <Button
        onClick={action('onClick')}
        variant={ButtonVariant.Primary}
        disabled
      >
        Hello world
      </Button>
    </p>

    <p>
      <Button onClick={action('onClick')} variant={ButtonVariant.Secondary}>
        Hello world
      </Button>
    </p>
    <p>
      <Button
        onClick={action('onClick')}
        variant={ButtonVariant.Secondary}
        disabled
      >
        Hello world
      </Button>
    </p>

    <p>
      <Button onClick={action('onClick')} variant={ButtonVariant.Destructive}>
        Hello world
      </Button>
    </p>
    <p>
      <Button
        onClick={action('onClick')}
        variant={ButtonVariant.Destructive}
        disabled
      >
        Hello world
      </Button>
    </p>
  </>
));
