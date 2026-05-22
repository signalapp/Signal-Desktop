// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useContext, type ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AnnouncementsOnlyGroupBannerAdminsDialog } from './AnnouncementsOnlyGroupBannerAdminsDialog.dom.tsx';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext.std.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { Emoji } from '../axo/emoji.std.ts';
import {
  ContactNameColors,
  type ContactNameColorType,
} from '../types/Colors.std.ts';
import { strictAssert } from '../util/assert.std.ts';

const { i18n } = window.SignalContext;

const groupAdmins = [
  {
    member: getDefaultConversation(),
    labelEmoji: undefined,
    labelString: undefined,
  },
  {
    member: getDefaultConversation(),
    labelEmoji: Emoji.CHECKMARK,
    labelString: 'Planner',
  },
  {
    member: getDefaultConversation(),
    labelEmoji: Emoji.unsafeCastMaybeInvalidStringToVariant('#'),
    labelString: 'Invalid Emoji',
  },
  {
    member: getDefaultConversation(),
    labelEmoji: undefined,
    labelString: 'No Emoji',
  },
];

const memberColors = new Map<string, ContactNameColorType>();
for (const [index, groupAdmin] of groupAdmins.entries()) {
  const color = ContactNameColors[index % ContactNameColors.length];
  strictAssert(color, 'Missing color');
  memberColors.set(groupAdmin.member.id, color);
}

export default {
  title: 'Components/AnnouncementsOnlyGroupBannerAdminsDialog',
} satisfies Meta;

export function Default(): ReactNode {
  const theme = useContext(StorybookThemeContext);
  return (
    <AnnouncementsOnlyGroupBannerAdminsDialog
      i18n={i18n}
      groupAdmins={groupAdmins}
      getPreferredBadge={() => undefined}
      memberColors={memberColors}
      open
      onOpenChange={action('onOpenChange')}
      showConversation={action('showConversation')}
      theme={theme}
    />
  );
}
