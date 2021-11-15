// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { select, text } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './TypingBubble';
import { TypingBubble } from './TypingBubble';
import { AvatarColors } from '../../types/Colors';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/TypingBubble', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  acceptedMessageRequest: true,
  badge: overrideProps.badge,
  isMe: false,
  i18n,
  color: select(
    'color',
    AvatarColors.reduce((m, c) => ({ ...m, [c]: c }), {}),
    overrideProps.color || AvatarColors[0]
  ),
  avatarPath: text('avatarPath', overrideProps.avatarPath || ''),
  title: '',
  profileName: text('profileName', overrideProps.profileName || ''),
  conversationType: select(
    'conversationType',
    { group: 'group', direct: 'direct' },
    overrideProps.conversationType || 'direct'
  ),
  sharedGroupNames: [],
  theme: ThemeType.light,
});

story.add('Direct', () => {
  const props = createProps();

  return <TypingBubble {...props} />;
});

story.add('Group', () => {
  const props = createProps({ conversationType: 'group' });

  return <TypingBubble {...props} />;
});

story.add('Group (with badge)', () => {
  const props = createProps({
    badge: getFakeBadge(),
    conversationType: 'group',
  });

  return <TypingBubble {...props} />;
});
