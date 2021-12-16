// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable-next-line max-classes-per-file */
import * as React from 'react';
import { storiesOf } from '@storybook/react';

import { setupI18n } from '../../util/setupI18n';
import { UUID } from '../../types/UUID';
import enMessages from '../../../_locales/en/messages.json';
import type { GroupV2ChangeType } from '../../groups';
import { SignalService as Proto } from '../../protobuf';
import type { SmartContactRendererType } from '../../groupChange';
import { GroupV2Change } from './GroupV2Change';
import type { FullJSXType } from '../Intl';

const i18n = setupI18n('en', enMessages);

const OUR_ID = UUID.generate().toString();
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

const renderChange = (change: GroupV2ChangeType, groupName?: string) => (
  <GroupV2Change
    change={change}
    groupName={groupName}
    i18n={i18n}
    ourUuid={OUR_ID}
    renderContact={renderContact}
  />
);

storiesOf('Components/Conversation/GroupV2Change', module)
  .add('Multiple', () => {
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
              uuid: OUR_ID,
            },
            {
              type: 'description',
              description: 'Another description',
            },
            {
              type: 'member-privilege',
              uuid: OUR_ID,
              newPrivilege: RoleEnum.ADMINISTRATOR,
            },
          ],
        })}
      </>
    );
  })
  .add('Create', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Title', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
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
  })
  .add('Avatar', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
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
  })
  .add('Access (Attributes)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
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
  })
  .add('Access (Members)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
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
  })
  .add('Access (Invite Link)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
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
  })
  .add('Member Add', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
          details: [
            {
              type: 'member-add',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'member-add',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Member Add (from invited)', () => {
    return (
      <>
        {/* the strings where someone added you - shown like a normal add */}
        {renderChange({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              uuid: OUR_ID,
              inviter: CONTACT_B,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'member-add-from-invite',
              uuid: OUR_ID,
              inviter: CONTACT_A,
            },
          ],
        })}
        {/* the rest of the 'someone added someone else' checks */}
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
          details: [
            {
              type: 'member-add-from-invite',
              uuid: OUR_ID,
              inviter: CONTACT_A,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
          details: [
            {
              type: 'member-add-from-invite',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              uuid: CONTACT_A,
              inviter: OUR_ID,
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
      </>
    );
  })
  .add('Member Add (from link)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
          details: [
            {
              type: 'member-add-from-link',
              uuid: OUR_ID,
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
  })
  .add('Member Add (from admin approval)', () => {
    return (
      <>
        {renderChange({
          from: ADMIN_A,
          details: [
            {
              type: 'member-add-from-admin-approval',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'member-add-from-admin-approval',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Member Remove', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
          details: [
            {
              type: 'member-remove',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: CONTACT_A,
          details: [
            {
              type: 'member-remove',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'member-remove',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Member Privilege', () => {
    return (
      <>
        {renderChange({
          from: CONTACT_A,
          details: [
            {
              type: 'member-privilege',
              uuid: OUR_ID,
              newPrivilege: RoleEnum.ADMINISTRATOR,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'member-privilege',
              uuid: OUR_ID,
              newPrivilege: RoleEnum.ADMINISTRATOR,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
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
              uuid: OUR_ID,
              newPrivilege: RoleEnum.DEFAULT,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'member-privilege',
              uuid: OUR_ID,
              newPrivilege: RoleEnum.DEFAULT,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Pending Add - one', () => {
    return (
      <>
        {renderChange({
          from: CONTACT_A,
          details: [
            {
              type: 'pending-add-one',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'pending-add-one',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Pending Add - many', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Pending Remove - one', () => {
    return (
      <>
        {renderChange({
          from: INVITEE_A,
          details: [
            {
              type: 'pending-remove-one',
              uuid: INVITEE_A,
              inviter: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
          details: [
            {
              type: 'pending-remove-one',
              uuid: INVITEE_A,
              inviter: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: ADMIN_A,
          details: [
            {
              type: 'pending-remove-one',
              uuid: INVITEE_A,
              inviter: OUR_ID,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'pending-remove-one',
              uuid: INVITEE_A,
              inviter: OUR_ID,
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
              uuid: OUR_ID,
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
          from: OUR_ID,
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
          from: OUR_ID,
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
  })
  .add('Pending Remove - many', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              inviter: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: ADMIN_A,
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              inviter: OUR_ID,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              inviter: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
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
  })
  .add('Admin Approval (Add)', () => {
    return (
      <>
        {renderChange({
          details: [
            {
              type: 'admin-approval-add-one',
              uuid: OUR_ID,
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
  })
  .add('Admin Approval (Remove)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
          details: [
            {
              type: 'admin-approval-remove-one',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'admin-approval-remove-one',
              uuid: OUR_ID,
            },
          ],
        })}
        {renderChange({
          from: OUR_ID,
          details: [
            {
              type: 'admin-approval-remove-one',
              uuid: CONTACT_A,
            },
          ],
        })}
        {renderChange({
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-remove-one',
              uuid: CONTACT_A,
            },
          ],
        })}
        {renderChange({
          from: ADMIN_A,
          details: [
            {
              type: 'admin-approval-remove-one',
              uuid: CONTACT_A,
            },
          ],
        })}
        {renderChange({
          details: [
            {
              type: 'admin-approval-remove-one',
              uuid: CONTACT_A,
            },
          ],
        })}
      </>
    );
  })
  .add('Group Link (Add)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
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
  })
  .add('Group Link (Reset)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Group Link (Remove)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Description (Remove)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
  })
  .add('Description (Change)', () => {
    return (
      <>
        {renderChange(
          {
            from: OUR_ID,
            details: [
              {
                type: 'description',
                description:
                  'This is a long description.\n\nWe need a dialog to view it all!\n\nIt has a link to https://example.com',
              },
            ],
          },
          'We do hikes 🌲'
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
          'We do hikes 🌲'
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
          'We do hikes 🌲'
        )}
      </>
    );
  })
  .add('Announcement Group (Change)', () => {
    return (
      <>
        {renderChange({
          from: OUR_ID,
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
          from: OUR_ID,
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
  });
