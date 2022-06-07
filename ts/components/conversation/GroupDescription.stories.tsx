// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { text } from '@storybook/addon-knobs';

import type { PropsType } from './GroupDescription';
import { GroupDescription } from './GroupDescription';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/GroupDescription',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  title: text('title', overrideProps.title || 'Sample Title'),
  text: text('text', overrideProps.text || 'Default group description'),
});

export const Default = (): JSX.Element => (
  <GroupDescription {...createProps()} />
);

export const Long = (): JSX.Element => (
  <GroupDescription
    {...createProps({
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed vehicula urna. Ut rhoncus, justo a vestibulum elementum, libero ligula molestie massa, et volutpat nibh ipsum sit amet enim. Vestibulum ac mi enim. Nulla fringilla justo justo, volutpat semper ex convallis quis. Proin posuere, mi at auctor tincidunt, magna turpis mattis nibh, ullamcorper vehicula lectus mauris in mauris. Nullam blandit sapien tortor, quis vehicula quam molestie nec. Nam sagittis dolor in eros dapibus scelerisque. Proin vitae ex sed magna lobortis tincidunt. Aenean dictum laoreet dolor, at suscipit ligula fermentum ac. Nam condimentum turpis quis sollicitudin rhoncus.',
    })}
  />
);

export const WithNewlines = (): JSX.Element => (
  <GroupDescription
    {...createProps({
      text: 'This is long\n\nSo many lines\n\nToo many lines?',
    })}
  />
);

WithNewlines.story = {
  name: 'With newlines',
};

export const WithEmoji = (): JSX.Element => (
  <GroupDescription
    {...createProps({
      text: '🍒🍩🌭',
    })}
  />
);

WithEmoji.story = {
  name: 'With emoji',
};

export const WithLink = (): JSX.Element => (
  <GroupDescription
    {...createProps({
      text: 'I love https://example.com and http://example.com and example.com, but not https://user:bar@example.com',
    })}
  />
);

WithLink.story = {
  name: 'With link',
};

export const KitchenSink = (): JSX.Element => (
  <GroupDescription
    {...createProps({
      text: '🍒 https://example.com this is a long thing\nhttps://example.com on another line\nhttps://example.com',
    })}
  />
);

KitchenSink.story = {
  name: 'Kitchen sink',
};
