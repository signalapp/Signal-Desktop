// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { Alert } from './Alert';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Alert',
};

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

const LOREM_IPSUM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra nec consectetur ante hendrerit. Donec et mollis dolor. Praesent et diam eget libero egestas mattis sit amet vitae augue. Nam tincidunt congue enim, ut porta lorem lacinia consectetur. Donec ut libero sed arcu vehicula ultricies a non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean ut gravida lorem. Ut turpis felis, pulvinar a semper sed, adipiscing id dolor. Pellentesque auctor nisi id magna consequat sagittis. Curabitur dapibus enim sit amet elit pharetra tincidunt feugiat nisl imperdiet. Ut convallis libero in urna ultrices accumsan. Donec sed odio eros. Donec viverra mi quis quam pulvinar at malesuada arcu rhoncus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. In rutrum accumsan ultricies. Mauris vitae nisi at sem facilisis semper ac in est.';

export const TitleAndBodyAreStrings = (): JSX.Element => (
  <Alert
    {...defaultProps}
    title="Hello world"
    body="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus."
  />
);

TitleAndBodyAreStrings.story = {
  name: 'Title and body are strings',
};

export const BodyIsAReactNode = (): JSX.Element => (
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
);

BodyIsAReactNode.story = {
  name: 'Body is a ReactNode',
};

export const LongBodyWithoutTitle = (): JSX.Element => (
  <Alert
    {...defaultProps}
    body={
      <>
        <p>{LOREM_IPSUM}</p>
        <p>{LOREM_IPSUM}</p>
        <p>{LOREM_IPSUM}</p>
        <p>{LOREM_IPSUM}</p>
      </>
    }
  />
);

LongBodyWithoutTitle.story = {
  name: 'Long body (without title)',
};

export const LongBodyWithTitle = (): JSX.Element => (
  <Alert
    {...defaultProps}
    title="Hello world"
    body={
      <>
        <p>{LOREM_IPSUM}</p>
        <p>{LOREM_IPSUM}</p>
        <p>{LOREM_IPSUM}</p>
        <p>{LOREM_IPSUM}</p>
      </>
    }
  />
);

LongBodyWithTitle.story = {
  name: 'Long body (with title)',
};
