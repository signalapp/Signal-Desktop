// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './GroupDescriptionInput';
import { GroupDescriptionInput } from './GroupDescriptionInput';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/GroupDescriptionInput',
} satisfies Meta<PropsType>;

function Wrapper({
  disabled,
  startingValue = '',
}: {
  disabled?: boolean;
  startingValue?: string;
}) {
  const [value, setValue] = useState(startingValue);

  return (
    <GroupDescriptionInput
      disabled={disabled}
      i18n={i18n}
      onChangeValue={setValue}
      value={value}
    />
  );
}

export function Default(): JSX.Element {
  return <Wrapper />;
}

export function Disabled(): JSX.Element {
  return (
    <>
      <Wrapper disabled />
      <br />
      <Wrapper disabled startingValue="Has a value" />
    </>
  );
}
