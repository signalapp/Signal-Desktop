// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect, useMemo } from 'react';
import type { Meta, Story } from '@storybook/react';
import { noop } from 'lodash';

import { Inbox } from './Inbox';
import type { PropsType } from './Inbox';
import { DAY, SECOND } from '../util/durations';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Inbox',
  argTypes: {
    i18n: {
      defaultValue: i18n,
    },
    hasInitialLoadCompleted: {
      defaultValue: false,
    },
    daysAgo: {
      control: 'select',
      defaultValue: undefined,
      options: [undefined, 1, 2, 3, 7, 14, 21],
    },
    isCustomizingPreferredReactions: {
      defaultValue: false,
    },
    onConversationClosed: {
      action: true,
    },
    onConversationOpened: {
      action: true,
    },
    scrollToMessage: {
      action: true,
    },
    showConversation: {
      action: true,
    },
    showWhatsNewModal: {
      action: true,
    },
  },
} as Meta;

// eslint-disable-next-line react/function-component-definition
const Template: Story<PropsType & { daysAgo?: number }> = ({
  daysAgo,
  ...args
}) => {
  const now = useMemo(() => Date.now(), []);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (daysAgo === undefined) {
      setOffset(0);
      return noop;
    }

    const interval = setInterval(() => {
      setOffset(prevValue => (prevValue + 1 / 4) % daysAgo);
    }, SECOND / 10);

    return () => clearInterval(interval);
  }, [now, daysAgo]);

  const firstEnvelopeTimestamp =
    daysAgo === undefined ? undefined : now - daysAgo * DAY;
  const envelopeTimestamp =
    firstEnvelopeTimestamp === undefined
      ? undefined
      : firstEnvelopeTimestamp + offset * DAY;

  return (
    <Inbox
      {...args}
      firstEnvelopeTimestamp={firstEnvelopeTimestamp}
      envelopeTimestamp={envelopeTimestamp}
      renderConversationView={() => <div />}
      renderCustomizingPreferredReactionsModal={() => <div />}
      renderLeftPane={() => <div />}
      renderMiniPlayer={() => <div />}
    />
  );
};

export const Default = Template.bind({});
Default.story = {
  name: 'Default',
};
