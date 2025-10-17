// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupTitleInput.dom.js';
import { GroupTitleInput } from './GroupTitleInput.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/GroupTitleInput',
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
    <GroupTitleInput
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
