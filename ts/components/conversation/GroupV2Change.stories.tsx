// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import { generateAci, generatePni } from '../../types/ServiceId';
import type { ServiceIdString, AciString } from '../../types/ServiceId';
import enMessages from '../../../_locales/en/messages.json';
import type { GroupV2ChangeType } from '../../groups';
import { SignalService as Proto } from '../../protobuf';
import type { SmartContactRendererType } from '../../groupChange';
import type { PropsType } from './GroupV2Change';
import { GroupV2Change } from './GroupV2Change';

// Note: this should be kept up to date with backup_groupv2_notifications_test.ts, to
//   maintain the comprehensive set of GroupV2 notifications we need to handle

const i18n = setupI18n('en', enMessages);

const OUR_ACI = generateAci();
const OUR_PNI = generatePni();
const CONTACT_A = generateAci();
const CONTACT_A_PNI = generatePni();
const CONTACT_B = generateAci();
const CONTACT_C = generateAci();
const ADMIN_A = generateAci();
const INVITEE_A = generateAci();

const contactMap = {
  [OUR_ACI]: 'YOU',
  [OUR_PNI]: 'YOU',
  [CONTACT_A]: 'CONTACT_A',
  [CONTACT_A_PNI]: 'CONTACT_A',
  [CONTACT_B]: 'CONTACT_B',
  [CONTACT_C]: 'CONTACT_C',
  [ADMIN_A]: 'ADMIN_A',
  [INVITEE_A]: 'INVITEE_A',
};

const AccessControlEnum = Proto.AccessControl.AccessRequired;
const RoleEnum = Proto.Member.Role;

const renderContact: SmartContactRendererType<JSX.Element> = (
  conversationId: string
) => (
  <React.Fragment key={conversationId}>
    {contactMap[conversationId] || 'UNKNOWN'}
  </React.Fragment>
);

const renderChange = (
  change: GroupV2ChangeType,
  {
    groupBannedMemberships,
    groupMemberships,
    groupName,
    areWeAdmin = true,
  }: {
    groupMemberships?: ReadonlyArray<{
      aci: AciString;
      isAdmin: boolean;
    }>;
    groupBannedMemberships?: ReadonlyArray<ServiceIdString>;
    groupName?: string;
    areWeAdmin?: boolean;
  } = {}
) => (
  <GroupV2Change
    areWeAdmin={areWeAdmin ?? true}
    blockGroupLinkRequests={action('blockGroupLinkRequests')}
    conversationId="some-conversation-id"
    change={change}
    groupBannedMemberships={groupBannedMemberships}
    groupMemberships={groupMemberships}
    groupName={groupName}
    i18n={i18n}
    ourAci={OUR_ACI}
    ourPni={OUR_PNI}
    renderContact={renderContact}
  />
);

export default {
  title: 'Components/Conversation/GroupV2Change',
} satisfies Meta<PropsType>;

export function Multiple(): JSX.Element {
  return (
    <>
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'title',
            newTitle: 'Saturday Running',
          },
          {
            type: 'avatar',
            removed: false,
          },
          {
            type: 'description',
            description:
              'This is a long description.\n\nWe need a dialog to view it all!\n\nIt has a link to https://example.com',
          },
          {
            type: 'member-add',
            aci: OUR_ACI,
          },
          {
            type: 'description',
            description: 'Another description',
          },
          {
            type: 'member-privilege',
            aci: OUR_ACI,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
    </>
  );
}

export function Create(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'create',
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'create',
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'create',
          },
        ],
      })}
    </>
  );
}

export function Title(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'title',
            newTitle: 'Saturday Running',
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'title',
            newTitle: 'Saturday Running',
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'title',
            newTitle: 'Saturday Running',
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'title',
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'title',
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'title',
          },
        ],
      })}
    </>
  );
}

export function Avatar(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'avatar',
            removed: false,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'avatar',
            removed: false,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'avatar',
            removed: false,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'avatar',
            removed: true,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'avatar',
            removed: true,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'avatar',
            removed: true,
          },
        ],
      })}
    </>
  );
}

export function AccessAttributes(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'access-attributes',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'access-attributes',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'access-attributes',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'access-attributes',
            newPrivilege: AccessControlEnum.MEMBER,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'access-attributes',
            newPrivilege: AccessControlEnum.MEMBER,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'access-attributes',
            newPrivilege: AccessControlEnum.MEMBER,
          },
        ],
      })}
    </>
  );
}

export function AccessMembers(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'access-members',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'access-members',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'access-members',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'access-members',
            newPrivilege: AccessControlEnum.MEMBER,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'access-members',
            newPrivilege: AccessControlEnum.MEMBER,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'access-members',
            newPrivilege: AccessControlEnum.MEMBER,
          },
        ],
      })}
    </>
  );
}

export function AccessInviteLink(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'access-invite-link',
            newPrivilege: AccessControlEnum.ANY,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'access-invite-link',
            newPrivilege: AccessControlEnum.ANY,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'access-invite-link',
            newPrivilege: AccessControlEnum.ANY,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'access-invite-link',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'access-invite-link',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'access-invite-link',
            newPrivilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
    </>
  );
}

export function MemberAdd(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add',
            aci: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'member-add',
            aci: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add',
            aci: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

export function MemberAddFromInvited(): JSX.Element {
  return (
    <>
      {/* the strings where someone added you - shown like a normal add */}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            aci: OUR_ACI,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-invite',
            aci: OUR_ACI,
            inviter: CONTACT_A,
          },
        ],
      })}
      {/* the rest of the 'someone added someone else' checks */}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: CONTACT_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            aci: CONTACT_B,
            inviter: CONTACT_C,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-invite',
            aci: CONTACT_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {/* in all of these we know the user has accepted the invite */}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: OUR_ACI,
            inviter: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            aci: CONTACT_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            aci: CONTACT_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            aci: CONTACT_A,
          },
        ],
      })}
      ACI accepts PNI invite (X joined the group)
      {renderChange({
        from: OUR_PNI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: OUR_ACI,
            pni: OUR_PNI,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: OUR_PNI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: OUR_ACI,
            pni: OUR_PNI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A_PNI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: CONTACT_A,
            pni: CONTACT_A_PNI,
          },
        ],
      })}
      ACI accepts PNI invite, the old way (X added X to group)
      {renderChange({
        from: OUR_PNI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: OUR_ACI,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: OUR_PNI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A_PNI,
        details: [
          {
            type: 'member-add-from-invite',
            aci: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

export function MemberAddFromLink(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add-from-link',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-link',
            aci: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-link',
            aci: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

export function MemberAddFromAdminApproval(): JSX.Element {
  return (
    <>
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'member-add-from-admin-approval',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-admin-approval',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add-from-admin-approval',
            aci: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'member-add-from-admin-approval',
            aci: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-admin-approval',
            aci: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

export function MemberRemove(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-remove',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-remove',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-remove',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-remove',
            aci: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-remove',
            aci: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'member-remove',
            aci: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-remove',
            aci: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

export function MemberPrivilege(): JSX.Element {
  return (
    <>
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-privilege',
            aci: OUR_ACI,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-privilege',
            aci: OUR_ACI,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-privilege',
            aci: CONTACT_A,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'member-privilege',
            aci: CONTACT_A,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-privilege',
            aci: CONTACT_A,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-privilege',
            aci: OUR_ACI,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-privilege',
            aci: OUR_ACI,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-privilege',
            aci: CONTACT_A,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'member-privilege',
            aci: CONTACT_A,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-privilege',
            aci: CONTACT_A,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
    </>
  );
}

export function PendingAddOne(): JSX.Element {
  return (
    <>
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'pending-add-one',
            serviceId: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-add-one',
            serviceId: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-add-one',
            serviceId: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'pending-add-one',
            serviceId: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-add-one',
            serviceId: INVITEE_A,
          },
        ],
      })}
    </>
  );
}

export function PendingAddMany(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-add-many',
            count: 5,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-add-many',
            count: 1,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'pending-add-many',
            count: 5,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'pending-add-many',
            count: 1,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-add-many',
            count: 5,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-add-many',
            count: 1,
          },
        ],
      })}
    </>
  );
}

export function PendingRemoveOne(): JSX.Element {
  return (
    <>
      {renderChange({
        from: INVITEE_A,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: INVITEE_A,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        from: INVITEE_A,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
            inviter: CONTACT_B,
          },
        ],
      })}

      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: OUR_ACI,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: CONTACT_B,
            inviter: CONTACT_A,
          },
        ],
      })}

      {renderChange({
        from: CONTACT_C,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
            inviter: CONTACT_B,
          },
        ],
      })}

      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-one',
            serviceId: INVITEE_A,
          },
        ],
      })}
    </>
  );
}

export function PendingRemoveMany(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
            inviter: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
            inviter: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
            inviter: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
            inviter: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
            inviter: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
            inviter: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
          },
        ],
      })}

      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-many',
            count: 5,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-many',
            count: 1,
          },
        ],
      })}
    </>
  );
}

export function AdminApprovalAdd(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'admin-approval-add-one',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'admin-approval-add-one',
            aci: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

export function AdminApprovalRemove(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'admin-approval-remove-one',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'admin-approval-remove-one',
            aci: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'admin-approval-remove-one',
            aci: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

export function AdminApprovalBounce(): JSX.Element {
  return (
    <>
      Should show button:
      {renderChange(
        {
          // From Joiner
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },
        {
          groupMemberships: [{ aci: CONTACT_C, isAdmin: false }],
          groupBannedMemberships: [CONTACT_B],
        }
      )}
      {renderChange(
        {
          // From nobody
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },
        {
          groupMemberships: [{ aci: CONTACT_C, isAdmin: false }],
          groupBannedMemberships: [CONTACT_B],
        }
      )}
      {renderChange({
        details: [
          {
            type: 'admin-approval-bounce',
            aci: CONTACT_A,
            times: 1,
            isApprovalPending: false,
          },
          // No group membership info
        ],
      })}
      Would show button, but we&apos;re not admin:
      {renderChange(
        {
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },

        { areWeAdmin: false, groupName: 'Group 1' }
      )}
      Would show button, but user is a group member:
      {renderChange(
        {
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },
        { groupMemberships: [{ aci: CONTACT_A, isAdmin: false }] }
      )}
      Would show button, but user is already banned:
      {renderChange(
        {
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },

        { groupBannedMemberships: [CONTACT_A] }
      )}
      Open request
      {renderChange(
        {
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 4,
              isApprovalPending: true,
            },
          ],
        },
        { groupBannedMemberships: [] }
      )}
    </>
  );
}

export function GroupLinkAdd(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'group-link-add',
            privilege: AccessControlEnum.ANY,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'group-link-add',
            privilege: AccessControlEnum.ANY,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'group-link-add',
            privilege: AccessControlEnum.ANY,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'group-link-add',
            privilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'group-link-add',
            privilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'group-link-add',
            privilege: AccessControlEnum.ADMINISTRATOR,
          },
        ],
      })}
    </>
  );
}

export function GroupLinkReset(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'group-link-reset',
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'group-link-reset',
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'group-link-reset',
          },
        ],
      })}
    </>
  );
}

export function GroupLinkRemove(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'group-link-remove',
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'group-link-remove',
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'group-link-remove',
          },
        ],
      })}
    </>
  );
}

export function DescriptionRemove(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            removed: true,
            type: 'description',
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            removed: true,
            type: 'description',
          },
        ],
      })}
      {renderChange({
        details: [
          {
            removed: true,
            type: 'description',
          },
        ],
      })}
    </>
  );
}

export function DescriptionChange(): JSX.Element {
  return (
    <>
      {renderChange(
        {
          from: OUR_ACI,
          details: [
            {
              type: 'description',
              description:
                'This is a long description.\n\nWe need a dialog to view it all!\n\nIt has a link to https://example.com',
            },
          ],
        },
        { groupName: 'We do hikes 🌲' }
      )}
      {renderChange(
        {
          from: ADMIN_A,
          details: [
            {
              type: 'description',
              description:
                'This is a long description.\n\nWe need a dialog to view it all!\n\nIt has a link to https://example.com',
            },
          ],
        },
        { groupName: 'We do hikes 🌲' }
      )}
      {renderChange(
        {
          details: [
            {
              type: 'description',
              description:
                'This is a long description.\n\nWe need a dialog to view it all!\n\nIt has a link to https://example.com',
            },
          ],
        },
        { groupName: 'We do hikes 🌲' }
      )}
    </>
  );
}

export function AnnouncementGroupChange(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'announcements-only',
            announcementsOnly: true,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'announcements-only',
            announcementsOnly: true,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'announcements-only',
            announcementsOnly: true,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'announcements-only',
            announcementsOnly: false,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'announcements-only',
            announcementsOnly: false,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'announcements-only',
            announcementsOnly: false,
          },
        ],
      })}
    </>
  );
}

export function Summary(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'summary',
          },
        ],
      })}
    </>
  );
}
