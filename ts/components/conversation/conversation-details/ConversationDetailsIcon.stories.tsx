// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ConversationDetailsIcon';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';

export default {
  title: 'Components/Conversation/ConversationDetails/ConversationDetailIcon',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props>): Props => ({
  ariaLabel: overrideProps.ariaLabel || '',
  icon: overrideProps.icon || IconType.timer,
  onClick: overrideProps.onClick,
});

export function All(): JSX.Element {
  const icons = Object.values(IconType);

  return (
    <>
      {icons.map(icon => (
        <ConversationDetailsIcon {...createProps({ icon })} />
      ))}
    </>
  );
}

export function ClickableIcons(): JSX.Element {
  const icons = [
    IconType.timer,
    IconType.trash,
    IconType.invites,
    IconType.block,
    IconType.leave,
    IconType.down,
  ];

  const onClick = action('onClick');

  return (
    <>
      {icons.map(icon => (
        <ConversationDetailsIcon {...createProps({ icon, onClick })} />
      ))}
    </>
  );
}
