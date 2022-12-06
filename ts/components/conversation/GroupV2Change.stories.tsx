// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';
import enMessages from '../../../_locales/en/messages.json';
import type { GroupV2ChangeType } from '../../groups';
import { SignalService as Proto } from '../../protobuf';
import type { SmartContactRendererType } from '../../groupChange';
import { GroupV2Change } from './GroupV2Change';
import type { FullJSXType } from '../Intl';

const i18n = setupI18n('en', enMessages);

const OUR_ACI = UUID.generate().toString();
const OUR_PNI = UUID.generate().toString();
const CONTACT_A = UUID.generate().toString();
const CONTACT_B = UUID.generate().toString();
const CONTACT_C = UUID.generate().toString();
const ADMIN_A = UUID.generate().toString();
const INVITEE_A = UUID.generate().toString();

const AccessControlEnum = Proto.AccessControl.AccessRequired;
const RoleEnum = Proto.Member.Role;

const renderContact: SmartContactRendererType<FullJSXType> = (
  conversationId: string
) => (
  <React.Fragment key={conversationId}>
    {`Conversation(${conversationId})`}
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
    groupMemberships?: Array<{
      uuid: UUIDStringType;
      isAdmin: boolean;
    }>;
    groupBannedMemberships?: Array<UUIDStringType>;
    groupName?: string;
    areWeAdmin?: boolean;
  } = {}
) => (
  <GroupV2Change
    areWeAdmin={areWeAdmin ?? true}
    blockGroupLinkRequests={action('blockGroupLinkRequests')}
    change={change}
    groupBannedMemberships={groupBannedMemberships}
    groupMemberships={groupMemberships}
    groupName={groupName}
    i18n={i18n}
    ourACI={OUR_ACI}
    ourPNI={OUR_PNI}
    renderContact={renderContact}
  />
);

export default {
  title: 'Components/Conversation/GroupV2Change',
};

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
            uuid: OUR_ACI,
          },
          {
            type: 'member-add',
            uuid: OUR_PNI,
          },
          {
            type: 'description',
            description: 'Another description',
          },
          {
            type: 'member-privilege',
            uuid: OUR_ACI,
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

AccessAttributes.story = {
  name: 'Access (Attributes)',
};

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

AccessMembers.story = {
  name: 'Access (Members)',
};

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

AccessInviteLink.story = {
  name: 'Access (Invite Link)',
};

export function MemberAdd(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add',
            uuid: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'member-add',
            uuid: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add',
            uuid: CONTACT_A,
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
            uuid: OUR_ACI,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-invite',
            uuid: OUR_ACI,
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
            uuid: CONTACT_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            uuid: CONTACT_B,
            inviter: CONTACT_C,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-invite',
            uuid: CONTACT_A,
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
            uuid: OUR_ACI,
            inviter: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add-from-invite',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            uuid: CONTACT_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            uuid: CONTACT_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-invite',
            uuid: CONTACT_A,
          },
        ],
      })}
      ACI accepts PNI invite:
      {renderChange({
        from: OUR_PNI,
        details: [
          {
            type: 'member-add-from-invite',
            uuid: OUR_ACI,
            inviter: CONTACT_B,
          },
        ],
      })}
    </>
  );
}

MemberAddFromInvited.story = {
  name: 'Member Add (from invited)',
};

export function MemberAddFromLink(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add-from-link',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-add-from-link',
            uuid: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-link',
            uuid: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

MemberAddFromLink.story = {
  name: 'Member Add (from link)',
};

export function MemberAddFromAdminApproval(): JSX.Element {
  return (
    <>
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'member-add-from-admin-approval',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-admin-approval',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-add-from-admin-approval',
            uuid: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'member-add-from-admin-approval',
            uuid: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-add-from-admin-approval',
            uuid: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

MemberAddFromAdminApproval.story = {
  name: 'Member Add (from admin approval)',
};

export function MemberRemove(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-remove',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-remove',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-remove',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-remove',
            uuid: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-remove',
            uuid: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'member-remove',
            uuid: CONTACT_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-remove',
            uuid: CONTACT_A,
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
            uuid: OUR_ACI,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-privilege',
            uuid: OUR_ACI,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-privilege',
            uuid: CONTACT_A,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'member-privilege',
            uuid: CONTACT_A,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-privilege',
            uuid: CONTACT_A,
            newPrivilege: RoleEnum.ADMINISTRATOR,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'member-privilege',
            uuid: OUR_ACI,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-privilege',
            uuid: OUR_ACI,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'member-privilege',
            uuid: CONTACT_A,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'member-privilege',
            uuid: CONTACT_A,
            newPrivilege: RoleEnum.DEFAULT,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'member-privilege',
            uuid: CONTACT_A,
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
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-add-one',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-add-one',
            uuid: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'pending-add-one',
            uuid: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-add-one',
            uuid: INVITEE_A,
          },
        ],
      })}
    </>
  );
}

PendingAddOne.story = {
  name: 'Pending Add - one',
};

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
        from: CONTACT_A,
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
            count: 5,
          },
        ],
      })}
    </>
  );
}

PendingAddMany.story = {
  name: 'Pending Add - many',
};

export function PendingRemoveOne(): JSX.Element {
  return (
    <>
      {renderChange({
        from: INVITEE_A,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: ADMIN_A,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
            inviter: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: INVITEE_A,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        from: INVITEE_A,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
            inviter: CONTACT_B,
          },
        ],
      })}

      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'pending-remove-one',
            uuid: OUR_ACI,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_A,
        details: [
          {
            type: 'pending-remove-one',
            uuid: CONTACT_B,
            inviter: CONTACT_A,
          },
        ],
      })}

      {renderChange({
        from: CONTACT_C,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
            inviter: CONTACT_B,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
            inviter: CONTACT_B,
          },
        ],
      })}

      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        from: CONTACT_B,
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'pending-remove-one',
            uuid: INVITEE_A,
          },
        ],
      })}
    </>
  );
}

PendingRemoveOne.story = {
  name: 'Pending Remove - one',
};

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
            count: 5,
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
        from: OUR_ACI,
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
            count: 5,
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
    </>
  );
}

PendingRemoveMany.story = {
  name: 'Pending Remove - many',
};

export function AdminApprovalAdd(): JSX.Element {
  return (
    <>
      {renderChange({
        details: [
          {
            type: 'admin-approval-add-one',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'admin-approval-add-one',
            uuid: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

AdminApprovalAdd.story = {
  name: 'Admin Approval (Add)',
};

export function AdminApprovalRemove(): JSX.Element {
  return (
    <>
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'admin-approval-remove-one',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        details: [
          {
            type: 'admin-approval-remove-one',
            uuid: OUR_ACI,
          },
        ],
      })}
      {renderChange({
        from: OUR_ACI,
        details: [
          {
            type: 'admin-approval-remove-one',
            uuid: CONTACT_A,
          },
        ],
      })}
    </>
  );
}

AdminApprovalRemove.story = {
  name: 'Admin Approval (Remove)',
};

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
              uuid: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },
        {
          groupMemberships: [{ uuid: CONTACT_C, isAdmin: false }],
          groupBannedMemberships: [CONTACT_B],
        }
      )}
      {renderChange(
        {
          // From nobody
          details: [
            {
              type: 'admin-approval-bounce',
              uuid: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },
        {
          groupMemberships: [{ uuid: CONTACT_C, isAdmin: false }],
          groupBannedMemberships: [CONTACT_B],
        }
      )}
      {renderChange({
        details: [
          {
            type: 'admin-approval-bounce',
            uuid: CONTACT_A,
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
              uuid: CONTACT_A,
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
              uuid: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },
        { groupMemberships: [{ uuid: CONTACT_A, isAdmin: false }] }
      )}
      Would show button, but user is already banned:
      {renderChange(
        {
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              uuid: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        },

        { groupBannedMemberships: [CONTACT_A] }
      )}
    </>
  );
}

AdminApprovalBounce.story = {
  name: 'Admin Approval (Bounce)',
};

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

GroupLinkAdd.story = {
  name: 'Group Link (Add)',
};

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

GroupLinkReset.story = {
  name: 'Group Link (Reset)',
};

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

GroupLinkRemove.story = {
  name: 'Group Link (Remove)',
};

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

DescriptionRemove.story = {
  name: 'Description (Remove)',
};

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

DescriptionChange.story = {
  name: 'Description (Change)',
};

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

AnnouncementGroupChange.story = {
  name: 'Announcement Group (Change)',
};

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
