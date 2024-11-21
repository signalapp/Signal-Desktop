// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect, useMemo } from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { noop } from 'lodash';

import { Inbox } from './Inbox';
import type { PropsType } from './Inbox';
import { DAY, SECOND } from '../util/durations';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Inbox',
  args: {
    i18n,
    hasInitialLoadCompleted: false,
    isNightly: false,
    isCustomizingPreferredReactions: false,
  },
  argTypes: {
    daysAgo: { control: { type: 'number' } },
    isNightly: { control: { type: 'boolean' } },
  },
} satisfies Meta<PropsType & { daysAgo?: number }>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType & { daysAgo?: number }> = ({
  daysAgo,
  ...args
}) => {
  const now = useMemo(() => Date.now(), []);
  const [dayOffset, setDayOffset] = useState(0);

  useEffect(() => {
    if (!daysAgo) {
      setDayOffset(0);
      return noop;
    }

    const interval = setInterval(() => {
      // Increment day offset by 1 / 24 of a day (an hour), and wrap it when it
      // reaches `daysAgo` value.
      setDayOffset(prevValue => (prevValue + 1 / 24) % daysAgo);
    }, SECOND / 10);

    return () => clearInterval(interval);
  }, [now, daysAgo]);

  const firstEnvelopeTimestamp =
    daysAgo === undefined ? undefined : now - daysAgo * DAY;
  const envelopeTimestamp =
    firstEnvelopeTimestamp === undefined
      ? undefined
      : firstEnvelopeTimestamp + dayOffset * DAY;

  return (
    <Inbox
      {...args}
      firstEnvelopeTimestamp={firstEnvelopeTimestamp}
      envelopeTimestamp={envelopeTimestamp}
      renderCustomizingPreferredReactionsModal={() => <div />}
    />
  );
};

export const Default = Template.bind({});

export const FourDaysAgo = Template.bind({});
FourDaysAgo.args = {
  daysAgo: 4,
};
