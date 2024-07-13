// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { PropsType } from './CountryCodeSelect';
import { CountryCodeSelect } from './CountryCodeSelect';
import { type ComponentMeta } from '../storybook/types';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

type StoryPropsType = Omit<PropsType, 'value' | 'onChange'>;

const DEMO_COUNTRIES = [
  {
    displayName: 'Belgium',
    region: 'BE',
    code: '+32',
  },
  {
    displayName: 'Canada',
    region: 'CA',
    code: '+1',
  },
  {
    displayName: 'France',
    region: 'FR',
    code: '+33',
  },
  {
    displayName: 'Germany',
    region: 'DE',
    code: '+49',
  },
  {
    displayName: 'Hong Kong',
    region: 'HK',
    code: '+852',
  },
  {
    displayName: 'Spain',
    region: 'ES',
    code: '+34',
  },
  {
    displayName: 'Switzerland',
    region: 'CH',
    code: '+41',
  },
  {
    displayName: 'USA',
    region: 'US',
    code: '+1',
  },
  {
    displayName: 'Japan',
    region: 'JP',
    code: '+81',
  },
];

function Template(args: StoryPropsType): JSX.Element {
  const [value, setValue] = useState('');

  return <CountryCodeSelect {...args} value={value} onChange={setValue} />;
}

export default {
  title: 'Components/CountryCodeSelect',
  component: Template,
  argTypes: {},
  args: {
    i18n,
    defaultRegion: 'US',
    countries: DEMO_COUNTRIES,
  },
} satisfies ComponentMeta<StoryPropsType>;

export function Defaults(args: StoryPropsType): JSX.Element {
  return <Template {...args} />;
}
