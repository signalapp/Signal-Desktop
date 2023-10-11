// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { ListTile } from './ListTile';
import type { Props } from './ListTile';
import { CircleCheckbox } from './CircleCheckbox';
import { UserText } from './UserText';

export default {
  title: 'Components/ListTile',
  component: ListTile,
} satisfies Meta<Props>;

const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam feugiat quam vitae semper facilisis. Praesent eu efficitur dui. Donec semper mattis nisl non hendrerit.';

function TemplateList(width: number): StoryFn<Props> {
  // eslint-disable-next-line react/display-name
  return args => {
    return (
      <div
        style={{
          width,
          height: 400,
          overflow: 'auto',
          outline: '1px solid gray',
        }}
      >
        <ListTile
          {...args}
          subtitle="Checkbox"
          trailing={<CircleCheckbox />}
          clickable
        />
        <ListTile
          {...args}
          subtitle="Checkbox"
          trailing={<CircleCheckbox checked />}
          clickable
        />
        <ListTile {...args} trailing={undefined} />
        <ListTile {...args} title={`Long title - ${lorem}`} />
        <ListTile {...args} subtitle="Disabled" disabled />
        <ListTile
          {...args}
          title={<UserText text="Emoji in title 📞" />}
          subtitle="Clickable"
          clickable
        />
        <ListTile
          {...args}
          title={<UserText text="With a LOT of emoji 🚗" />}
          subtitle={
            <UserText text="😂, 😃, 🧘🏻‍♂️, 🌍, 🌦️, 🍞, 🚗, 📞, 🎉, ❤️, 🍆, 🍑 and 🏁" />
          }
        />
        <ListTile
          {...args}
          subtitle={`One line max - ${lorem}`}
          subtitleMaxLines={1}
        />
        <ListTile
          {...args}
          subtitle={`Two lines max - ${lorem}`}
          subtitleMaxLines={2}
        />
        <ListTile
          {...args}
          subtitle={`Three lines max - ${lorem}`}
          subtitleMaxLines={3}
        />
        <ListTile
          {...args}
          subtitle="Button root element"
          rootElement="button"
        />
      </div>
    );
  };
}

const circleAvatar = (
  <div
    style={{ borderRadius: '100%', background: 'gray', width: 36, height: 36 }}
  />
);

export const Item = TemplateList(400).bind({});
Item.args = {
  leading: circleAvatar,
  title: <UserText text="Some user" />,
  subtitle: 'Hello my friend',
  clickable: true,
};

export const PanelRow = TemplateList(800).bind({});
PanelRow.args = {
  leading: circleAvatar,
  title: 'Some user',
  subtitle: 'Hello my friend',
  trailing: <div className="ConversationDetails-panel-row__right">Admin</div>,
  clickable: false,
  variant: 'panelrow',
};
