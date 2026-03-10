// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { sample } from 'lodash';

import type { PropsType } from './GroupMemberLabelEditor.dom.js';
import { GroupMemberLabelEditor } from './GroupMemberLabelEditor.dom.js';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';
import { ThemeType } from '../../../types/Util.std.js';
import { getFakeBadge } from '../../../test-helpers/getFakeBadge.std.js';
import { SECOND } from '../../../util/durations/constants.std.js';
import { sleep } from '../../../util/sleep.std.js';
import { SignalService as Proto } from '../../../protobuf/index.std.js';
import { ContactNameColors } from '../../../types/Colors.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ConversationDetails/GroupMemberLabelEditor',
} satisfies Meta<PropsType>;

const createProps = (): PropsType => ({
  group: getDefaultConversation({ type: 'group' }),
  me: getDefaultConversation({ type: 'direct' }),
  existingLabelEmoji: '🐘',
  existingLabelString: 'Good Memory',
  getPreferredBadge: () => undefined,
  i18n,
  membersWithLabel: [],
  ourColor: '160',
  popPanelForConversation: action('popPanelForConversation'),
  theme: ThemeType.light,
  updateGroupMemberLabel: async (
    options,
    callbacks?: { onSuccess?: () => unknown }
  ) => {
    action('updateGroupMemberLabel')(options);
    await sleep(SECOND);
    callbacks?.onSuccess?.();
  },
});

export function NoExistingLabel(): React.JSX.Element {
  const props = {
    ...createProps(),
    existingLabelEmoji: undefined,
    existingLabelString: undefined,
  };

  return <GroupMemberLabelEditor {...props} />;
}

export function ExistingLabel(): React.JSX.Element {
  const props = createProps();

  return <GroupMemberLabelEditor {...props} />;
}

export function StringButNoEmoji(): React.JSX.Element {
  const props = {
    ...createProps(),
    existingLabelEmoji: undefined,
  };

  return <GroupMemberLabelEditor {...props} />;
}

export function WithBadge(): React.JSX.Element {
  const props = {
    ...createProps(),
    getPreferredBadge: () => getFakeBadge(),
  };

  return <GroupMemberLabelEditor {...props} />;
}

export function ThrowsErrorOnSave(): React.JSX.Element {
  const props: PropsType = {
    ...createProps(),
    updateGroupMemberLabel: async (
      options,
      callbacks?: { onFailure?: () => unknown }
    ) => {
      action('updateGroupMemberLabel')(options);
      await sleep(SECOND);
      callbacks?.onFailure?.();
    },
  };

  return <GroupMemberLabelEditor {...props} />;
}

export function PermissionsError(): React.JSX.Element {
  const props: PropsType = createProps();

  return (
    <GroupMemberLabelEditor
      {...props}
      group={{
        ...props.group,
        areWeAdmin: false,
        accessControlAttributes:
          Proto.AccessControl.AccessRequired.ADMINISTRATOR,
      }}
    />
  );
}

export function PermissionsRestrictedButAdmin(): React.JSX.Element {
  const props: PropsType = createProps();

  return (
    <GroupMemberLabelEditor
      {...props}
      group={{
        ...props.group,
        areWeAdmin: true,
        accessControlAttributes:
          Proto.AccessControl.AccessRequired.ADMINISTRATOR,
      }}
    />
  );
}

export function NoMembersWithLabel(): React.JSX.Element {
  const props: PropsType = createProps();

  return <GroupMemberLabelEditor {...props} membersWithLabel={[]} />;
}

export function AFewMembersWithLabel(): React.JSX.Element {
  const props: PropsType = createProps();

  return (
    <GroupMemberLabelEditor
      {...props}
      membersWithLabel={ContactNameColors.slice(0, 3).map(
        (contactNameColor, i) => ({
          member: getDefaultConversation(),
          isAdmin: i <= 2,
          labelEmoji: sample([
            '⚫',
            '❤️',
            '🫥',
            '🤍',
            '2️⃣',
            '3️⃣',
            '🥂',
            '🎊',
            '➕',
            '😵‍💫',
            '🚲',
            '🐶',
            '🐱',
            '🏠',
          ]),
          labelString:
            i % 2 === 0
              ? `Label number long long long long long long long long long ${i}`
              : `Label member ${i}`,
          contactNameColor,
        })
      )}
    />
  );
}

export function LotsOfMembersWithLabel(): React.JSX.Element {
  const props: PropsType = createProps();

  return (
    <GroupMemberLabelEditor
      {...props}
      membersWithLabel={ContactNameColors.map((contactNameColor, i) => ({
        member: getDefaultConversation(),
        isAdmin: i <= 6,
        labelEmoji: sample([
          '⚫',
          '❤️',
          '🫥',
          '🤍',
          '2️⃣',
          '3️⃣',
          '🥂',
          '🎊',
          '➕',
          '😵‍💫',
          '🚲',
          '🐶',
          '🐱',
          '🏠',
        ]),
        labelString:
          i % 2 === 0
            ? `Label number long long long long long long long long long ${i}`
            : `Label member ${i}`,
        contactNameColor,
      }))}
    />
  );
}
