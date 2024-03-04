// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { ComponentMeta } from '../storybook/types';
import type { Props } from './Intl';
import { Intl } from './Intl';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Intl',
  component: Intl,
  args: {
    i18n,
    id: 'icu:ok',
    components: undefined,
  },
} satisfies ComponentMeta<Props<'icu:ok'>>;

export function NoReplacements(
  args: Props<'icu:deleteAndRestart'>
): JSX.Element {
  return <Intl {...args} id="icu:deleteAndRestart" />;
}

export function SingleStringReplacement(
  args: Props<'icu:leftTheGroup'>
): JSX.Element {
  return (
    <Intl {...args} id="icu:leftTheGroup" components={{ name: 'Theodora' }} />
  );
}

export function SingleTagReplacement(
  args: Props<'icu:leftTheGroup'>
): JSX.Element {
  return (
    <Intl
      {...args}
      id="icu:leftTheGroup"
      components={{
        name: (
          <button type="button" key="a-button">
            Theodora
          </button>
        ),
      }}
    />
  );
}

export function MultipleStringReplacement(
  args: Props<'icu:changedRightAfterVerify'>
): JSX.Element {
  return (
    <Intl
      {...args}
      id="icu:changedRightAfterVerify"
      components={{ name1: 'Fred', name2: 'The Fredster' }}
    />
  );
}

export function MultipleTagReplacement(
  args: Props<'icu:changedRightAfterVerify'>
): JSX.Element {
  return (
    <Intl
      {...args}
      id="icu:changedRightAfterVerify"
      components={{ name1: <b>Fred</b>, name2: <b>The Fredster</b> }}
    />
  );
}

export function Emoji(
  args: Props<'icu:Message__reaction-emoji-label--you'>
): JSX.Element {
  return (
    <Intl
      {...args}
      id="icu:Message__reaction-emoji-label--you"
      components={{ emoji: '😛' }}
    />
  );
}
