// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { storiesOf } from '@storybook/react';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

import { GroupTitleInput } from './GroupTitleInput';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/GroupTitleInput', module);

const Wrapper = ({
  disabled,
  startingValue = '',
}: {
  disabled?: boolean;
  startingValue?: string;
}) => {
  const [value, setValue] = useState(startingValue);

  return (
    <GroupTitleInput
      disabled={disabled}
      i18n={i18n}
      onChangeValue={setValue}
      value={value}
    />
  );
};

story.add('Default', () => <Wrapper />);

story.add('Disabled', () => (
  <>
    <Wrapper disabled />
    <br />
    <Wrapper disabled startingValue="Has a value" />
  </>
));
