// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { ComponentMeta } from '../storybook/types';
import type { Props } from './I18n';
import { I18n } from './I18n';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/I18n',
  component: I18n,
  args: {
    i18n,
    id: 'icu:ok',
    components: undefined,
  },
} satisfies ComponentMeta<Props<'icu:ok'>>;

export function NoReplacements(
  args: Props<'icu:deleteAndRestart'>
): JSX.Element {
  return <I18n {...args} id="icu:deleteAndRestart" />;
}

export function SingleStringReplacement(
  args: Props<'icu:leftTheGroup'>
): JSX.Element {
  return (
    <I18n {...args} id="icu:leftTheGroup" components={{ name: 'Theodora' }} />
  );
}

export function SingleTagReplacement(
  args: Props<'icu:leftTheGroup'>
): JSX.Element {
  return (
    <I18n
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
    <I18n
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
    <I18n
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
    <I18n
      {...args}
      id="icu:Message__reaction-emoji-label--you"
      components={{ emoji: '😛' }}
    />
  );
}
