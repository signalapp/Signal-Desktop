// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { select, text } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { Props, TypingBubble } from './TypingBubble';
import { Colors } from '../../types/Colors';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/TypingBubble', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  color: select(
    'color',
    Colors.reduce((m, c) => ({ ...m, [c]: c }), {}),
    overrideProps.color || 'red'
  ),
  avatarPath: text('avatarPath', overrideProps.avatarPath || ''),
  title: '',
  profileName: text('profileName', overrideProps.profileName || ''),
  conversationType: select(
    'conversationType',
    { group: 'group', direct: 'direct' },
    overrideProps.conversationType || 'direct'
  ),
});

story.add('Direct', () => {
  const props = createProps();

  return <TypingBubble {...props} />;
});

story.add('Group', () => {
  const props = createProps({ conversationType: 'group' });

  return <TypingBubble {...props} />;
});
