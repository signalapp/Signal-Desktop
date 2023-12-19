// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupDescription';
import { GroupDescription } from './GroupDescription';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/GroupDescription',
  argTypes: {
    title: { control: { type: 'text' } },
    text: { control: { type: 'text' } },
  },
  args: {
    i18n,
    title: 'Sample Title',
    text: 'Default group description',
  },
} satisfies Meta<PropsType>;

export function Default(args: PropsType): JSX.Element {
  return <GroupDescription {...args} />;
}

export function Long(args: PropsType): JSX.Element {
  return (
    <GroupDescription
      {...args}
      text="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed vehicula urna. Ut rhoncus, justo a vestibulum elementum, libero ligula molestie massa, et volutpat nibh ipsum sit amet enim. Vestibulum ac mi enim. Nulla fringilla justo justo, volutpat semper ex convallis quis. Proin posuere, mi at auctor tincidunt, magna turpis mattis nibh, ullamcorper vehicula lectus mauris in mauris. Nullam blandit sapien tortor, quis vehicula quam molestie nec. Nam sagittis dolor in eros dapibus scelerisque. Proin vitae ex sed magna lobortis tincidunt. Aenean dictum laoreet dolor, at suscipit ligula fermentum ac. Nam condimentum turpis quis sollicitudin rhoncus."
    />
  );
}

export function WithNewlines(args: PropsType): JSX.Element {
  return (
    <GroupDescription
      {...args}
      text="This is long\n\nSo many lines\n\nToo many lines?"
    />
  );
}

export function WithEmoji(args: PropsType): JSX.Element {
  return <GroupDescription {...args} text="🍒🍩🌭" />;
}

export function WithLink(args: PropsType): JSX.Element {
  return (
    <GroupDescription
      {...args}
      text="I love https://example.com and http://example.com and example.com, but not https://user:bar@example.com"
    />
  );
}

export function KitchenSink(args: PropsType): JSX.Element {
  return (
    <GroupDescription
      {...args}
      text="🍒 https://example.com this is a long thing\nhttps://example.com on another line\nhttps://example.com"
    />
  );
}
