// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { DisappearingTimerSelect } from './DisappearingTimerSelect';
import { setupI18n } from '../util/setupI18n';
import { DurationInSeconds } from '../util/durations';
import enMessages from '../../_locales/en/messages.json';

export default {
  title: 'Components/DisappearingTimerSelect',
};

const i18n = setupI18n('en', enMessages);

type Props = {
  initialValue: number;
};

function TimerSelectWrap({ initialValue }: Props): JSX.Element {
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

InitialValue1Day.story = {
  name: 'Initial value: 1 day',
};

export function InitialValue3DaysCustomTime(): JSX.Element {
  return <TimerSelectWrap initialValue={3 * 24 * 3600} />;
}

InitialValue3DaysCustomTime.story = {
  name: 'Initial value 3 days (Custom time)',
};
