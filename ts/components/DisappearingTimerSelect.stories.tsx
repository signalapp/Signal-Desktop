// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './DisappearingTimerSelect.dom.js';
import { DisappearingTimerSelect } from './DisappearingTimerSelect.dom.js';
import { DurationInSeconds } from '../util/durations/index.std.js';

export default {
  title: 'Components/DisappearingTimerSelect',
} satisfies Meta<Props>;

const { i18n } = window.SignalContext;

type Args = {
  initialValue: number;
};

function TimerSelectWrap({ initialValue }: Args): JSX.Element {
  const [value, setValue] = useState(initialValue);

  return (
    <DisappearingTimerSelect
      i18n={i18n}
      value={DurationInSeconds.fromSeconds(value)}
      onChange={newValue => setValue(newValue)}
    />
  );
}

export function InitialValue1Day(): JSX.Element {
  return <TimerSelectWrap initialValue={24 * 3600} />;
}

export function InitialValue3DaysCustomTime(): JSX.Element {
  return <TimerSelectWrap initialValue={3 * 24 * 3600} />;
}
