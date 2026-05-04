// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { sample } from 'lodash';

import type { PropsType } from './GroupMemberLabelEditor.dom.tsx';
import { GroupMemberLabelEditor } from './GroupMemberLabelEditor.dom.tsx';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.ts';
import { ThemeType } from '../../../types/Util.std.ts';
import { getFakeBadge } from '../../../test-helpers/getFakeBadge.std.ts';
import { SECOND } from '../../../util/durations/constants.std.ts';
import { sleep } from '../../../util/sleep.std.ts';
import { SignalService as Proto } from '../../../protobuf/index.std.ts';
import { ContactNameColors } from '../../../types/Colors.std.ts';
import { Emoji } from '../../../axo/emoji.std.ts';

const { i18n } = window.SignalContext;

function getRandomEmoji() {
  return sample([
    Emoji.BLACK_CIRCLE,
    Emoji.HEART,
    Emoji.DOTTED_LINE_FACE,
    Emoji.WHITE_HEART,
    Emoji.TWO,
    Emoji.THREE,
    Emoji.CLINKING_GLASSES,
    Emoji.CONFETTI_BALL,
    Emoji.PLUS,
    Emoji.FACE_WITH_SPIRAL_EYES,
    Emoji.BIKE,
    Emoji.DOG,
    Emoji.CAT,
    Emoji.HOUSE,
  ]);
}

export default {
  title: 'Components/Conversation/ConversationDetails/GroupMemberLabelEditor',
} satisfies Meta<PropsType>;

const createProps = (): PropsType => ({
  canAddLabel: true,
  existingLabelEmoji: Emoji.ELEPHANT,
  existingLabelString: 'Good Memory',
  getPreferredBadge: () => undefined,
  group: getDefaultConversation({ type: 'group' }),
  i18n,
  isActive: true,
  me: getDefaultConversation({ type: 'direct' }),
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

export function NoExistingLabel(): JSX.Element {
  const props = {
    ...createProps(),
    existingLabelEmoji: undefined,
    existingLabelString: undefined,
  };

  return <GroupMemberLabelEditor {...props} />;
}

export function ExistingLabel(): JSX.Element {
  const props = createProps();

  return <GroupMemberLabelEditor {...props} />;
}

export function StringButNoEmoji(): JSX.Element {
  const props = {
    ...createProps(),
    existingLabelEmoji: undefined,
  };

  return <GroupMemberLabelEditor {...props} />;
}

export function WithBadge(): JSX.Element {
  const props = {
    ...createProps(),
    getPreferredBadge: () => getFakeBadge(),
  };

  return <GroupMemberLabelEditor {...props} />;
}

export function ThrowsErrorOnSave(): JSX.Element {
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

export function PermissionsError(): JSX.Element {
  const props: PropsType = createProps();

  return <GroupMemberLabelEditor {...props} canAddLabel={false} />;
}

export function PermissionsRestrictedButAdmin(): JSX.Element {
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

export function NoMembersWithLabel(): JSX.Element {
  const props: PropsType = createProps();

  return <GroupMemberLabelEditor {...props} membersWithLabel={[]} />;
}

export function AFewMembersWithLabel(): JSX.Element {
  const props: PropsType = createProps();

  return (
    <GroupMemberLabelEditor
      {...props}
      membersWithLabel={ContactNameColors.slice(0, 3).map(
        (contactNameColor, i) => ({
          member: getDefaultConversation(),
          isAdmin: i <= 2,
          labelEmoji: getRandomEmoji(),
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

export function LotsOfMembersWithLabel(): JSX.Element {
  const props: PropsType = createProps();

  return (
    <GroupMemberLabelEditor
      {...props}
      membersWithLabel={ContactNameColors.map((contactNameColor, i) => ({
        member: getDefaultConversation(),
        isAdmin: i <= 6,
        labelEmoji: getRandomEmoji(),
        labelString:
          i % 2 === 0
            ? `Label number long long long long long long long long long ${i}`
            : `Label member ${i}`,
        contactNameColor,
      }))}
    />
  );
}
