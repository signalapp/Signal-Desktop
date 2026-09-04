// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useContext, type JSX } from 'react';
import lodash from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './PendingInvites.dom.tsx';
import { PendingInvites } from './PendingInvites.dom.tsx';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../../test-helpers/getDefaultConversation.std.ts';
import { getFakeBadge } from '../../../test-helpers/getFakeBadge.std.ts';
import { StorybookThemeContext } from '../../../../.storybook/StorybookThemeContext.std.ts';
import { generateAci } from '../../../test-helpers/serviceIdUtils.std.ts';

const { times } = lodash;

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ConversationDetails/PendingInvites',
} satisfies Meta<PropsType>;

const baseGroup = getDefaultGroup({
  areWeAdmin: true,
});

const group = {
  ...baseGroup,
  sortedGroupMembers: baseGroup.memberships?.map(membership => {
    return getDefaultConversation({ serviceId: membership.aci });
  }),
};

const OUR_UUID = generateAci();

function getRandomItem<T>(array: ReadonlyArray<T>): T {
  // oxlint-disable-next-line typescript/no-non-null-assertion
  return array[Math.floor(Math.random() * array.length)]!;
}

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  approvePendingMembershipFromGroupV2: action(
    'approvePendingMembershipFromGroupV2'
  ),
  conversation: group,
  getPreferredBadge: () => undefined,
  i18n,
  ourAci: OUR_UUID,
  pendingApprovalMemberships: times(5, () => ({
    member: getDefaultConversation(),
  })),
  pendingMemberships: [
    ...times(4, () => ({
      member: getDefaultConversation(),
      metadata: {
        addedByUserId: OUR_UUID,
      },
    })),
    ...times(8, () => ({
      member: getDefaultConversation(),
      metadata: {
        addedByUserId: getRandomItem(group.memberships ?? [])?.aci,
      },
    })),
  ],
  revokePendingMembershipsFromGroupV2: action(
    'revokePendingMembershipsFromGroupV2'
  ),
  theme: useContext(StorybookThemeContext),
  ...overrideProps,
});

export function Basic(): JSX.Element {
  const props = useProps();

  return <PendingInvites {...props} />;
}

export function WithBadges(): JSX.Element {
  const props = useProps({ getPreferredBadge: () => getFakeBadge() });

  return <PendingInvites {...props} />;
}
