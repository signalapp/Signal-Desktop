// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { Alert } from './Alert';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Alert', module);

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

story.add('Title and body are strings', () => (
  <Alert
    {...defaultProps}
    title="Hello world"
    body="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus."
  />
));

story.add('Body is a ReactNode', () => (
  <Alert
    {...defaultProps}
    title="Hello world"
    body={
      <>
        <span style={{ color: 'red' }}>Hello</span>{' '}
        <span style={{ color: 'green', fontWeight: 'bold' }}>world</span>!
      </>
    }
  />
));
