// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateGuid } from 'uuid';

import { DataWriter } from '../../sql/Client';
import { SignalService as Proto } from '../../protobuf';

import { generateAci, generatePni } from '../../types/ServiceId';
import type { ServiceIdString } from '../../types/ServiceId';
import type { MessageAttributesType } from '../../model-types';
import type { GroupV2ChangeType } from '../../groups';
import { getRandomBytes } from '../../Crypto';
import * as Bytes from '../../Bytes';
import { strictAssert } from '../../util/assert';
import { DurationInSeconds } from '../../util/durations';
import {
  OUR_ACI,
  OUR_PNI,
  setupBasics,
  asymmetricRoundtripHarness,
  symmetricRoundtripHarness,
} from './helpers';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders';

// Note: this should be kept up to date with GroupV2Change.stories.tsx, to
//   maintain the comprehensive set of GroupV2 notifications we need to handle

const AccessControlEnum = Proto.AccessControl.AccessRequired;
const RoleEnum = Proto.Member.Role;
const EXPIRATION_TIMER_FLAG = Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;

const CONTACT_A = generateAci();
const CONTACT_A_PNI = generatePni();
const CONTACT_A_E164 = '+121355501234';
const CONTACT_B = generateAci();
const CONTACT_C = generateAci();
const ADMIN_A = generateAci();
const INVITEE_A = generateAci();

const GROUP_ID = Bytes.toBase64(getRandomBytes(32));

let counter = 0;

function createMessage(
  change: GroupV2ChangeType,
  {
    disableIncrement = false,
    sourceServiceId = change.from || OUR_ACI,
  }: {
    disableIncrement?: boolean;
    sourceServiceId?: ServiceIdString;
  } = {
    disableIncrement: false,
  }
): MessageAttributesType {
  const groupConversation = window.ConversationController.get(GROUP_ID);
  strictAssert(groupConversation, 'The group conversation must be created!');
  if (!disableIncrement) {
    counter += 1;
  }

  return {
    conversationId: groupConversation.id,
    groupV2Change: change,
    id: generateGuid(),
    received_at: counter,
    sent_at: counter,
    timestamp: counter,
    readStatus: ReadStatus.Read,
    seenStatus: SeenStatus.Seen,
    type: 'group-v2-change',
    sourceServiceId,
    source:
      sourceServiceId === CONTACT_A || sourceServiceId === CONTACT_A_PNI
        ? CONTACT_A_E164
        : undefined,
  };
}

describe('backup/groupv2/notifications', () => {
  beforeEach(async () => {
    await DataWriter.removeAll();
    window.ConversationController.reset();
    window.storage.reset();

    await setupBasics();

    await window.ConversationController.getOrCreateAndWait(
      CONTACT_A,
      'private',
      {
        pni: CONTACT_A_PNI,
        e164: CONTACT_A_E164,
        systemGivenName: 'CONTACT_A',
        active_at: 1,
      }
    );
    await window.ConversationController.getOrCreateAndWait(
      CONTACT_B,
      'private',
      { systemGivenName: 'CONTACT_B', active_at: 1 }
    );
    await window.ConversationController.getOrCreateAndWait(
      CONTACT_C,
      'private',
      { systemGivenName: 'CONTACT_C', active_at: 1 }
    );
    await window.ConversationController.getOrCreateAndWait(ADMIN_A, 'private', {
      systemGivenName: 'ADMIN_A',
      active_at: 1,
    });
    await window.ConversationController.getOrCreateAndWait(
      INVITEE_A,
      'private',
      {
        systemGivenName: 'INVITEE_A',
        active_at: 1,
      }
    );
    await window.ConversationController.getOrCreateAndWait(GROUP_ID, 'group', {
      groupVersion: 2,
      masterKey: Bytes.toBase64(getRandomBytes(32)),
      name: 'Rock Enthusiasts',
      active_at: 1,
    });

    await loadAllAndReinitializeRedux();
  });
  afterEach(async () => {
    await DataWriter.removeAll();
  });

  describe('roundtrips given groupv2 notifications with', () => {
    it('Multiple items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
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
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('Create items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'create',
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'create',
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'create',
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('Title items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'title',
              newTitle: 'Saturday Running',
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'title',
              newTitle: 'Saturday Running',
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'title',
              newTitle: 'Saturday Running',
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'title',
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'title',
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'title',
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('Avatar items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'avatar',
              removed: false,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'avatar',
              removed: false,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'avatar',
              removed: false,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'avatar',
              removed: true,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'avatar',
              removed: true,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'avatar',
              removed: true,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('AccessAttributes items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'access-attributes',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'access-attributes',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'access-attributes',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'access-attributes',
              newPrivilege: AccessControlEnum.MEMBER,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'access-attributes',
              newPrivilege: AccessControlEnum.MEMBER,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'access-attributes',
              newPrivilege: AccessControlEnum.MEMBER,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('AccessMembers items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'access-members',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'access-members',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'access-members',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'access-members',
              newPrivilege: AccessControlEnum.MEMBER,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'access-members',
              newPrivilege: AccessControlEnum.MEMBER,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'access-members',
              newPrivilege: AccessControlEnum.MEMBER,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('AccessInviteLink items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'access-invite-link',
              newPrivilege: AccessControlEnum.ANY,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'access-invite-link',
              newPrivilege: AccessControlEnum.ANY,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'access-invite-link',
              newPrivilege: AccessControlEnum.ANY,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'access-invite-link',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'access-invite-link',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'access-invite-link',
              newPrivilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('MemberAdd items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-add',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-add',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-add',
              aci: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: CONTACT_B,
          details: [
            {
              type: 'member-add',
              aci: CONTACT_A,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-add',
              aci: CONTACT_A,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('MemberAddFromInvited items', async () => {
      const messages: Array<MessageAttributesType> = [
        // the strings where someone added you - shown like a normal add
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              aci: OUR_ACI,
              inviter: CONTACT_B,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-add-from-invite',
              aci: OUR_ACI,
              inviter: CONTACT_A,
            },
          ],
        }),
        // the rest of the 'someone added someone else' checks */
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
              inviter: CONTACT_B,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_B,
              inviter: CONTACT_C,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
              inviter: CONTACT_B,
            },
          ],
        }),
        // in all of these we know the user has accepted the invite
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: OUR_ACI,
              inviter: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
              inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
              inviter: CONTACT_B,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
            },
          ],
        }),
        // ACI accepts PNI invite (X joined the group)
        // These don't roundtrip; the PNI from is replaced with ACI. See next test below.
        // createMessage({
        //   from: OUR_PNI,
        //   details: [
        //     {
        //       type: 'member-add-from-invite',
        //       aci: OUR_ACI,
        //       pni: OUR_PNI,
        //       inviter: CONTACT_B,
        //     },
        //   ],
        // }),
        // createMessage({
        //   from: OUR_PNI,
        //   details: [
        //     {
        //       type: 'member-add-from-invite',
        //       aci: OUR_ACI,
        //       pni: OUR_PNI,
        //     },
        //   ],
        // }),
        // createMessage({
        //   from: CONTACT_A_PNI,
        //   details: [
        //     {
        //       type: 'member-add-from-invite',
        //       aci: CONTACT_A,
        //       pni: CONTACT_A_PNI,
        //     },
        //   ],
        // }),
        // ACI accepts PNI invite, the old way (X added X to group)
        // These don't roundtrip; the PNI is replaced with ACI. See next test below.
        // createMessage({
        //   from: OUR_PNI,
        //   details: [
        //     {
        //       type: 'member-add-from-invite',
        //       aci: OUR_ACI,
        //       inviter: CONTACT_B,
        //     },
        //   ],
        // }),
        // createMessage({
        //   from: OUR_PNI,
        //   details: [
        //     {
        //       type: 'member-add-from-invite',
        //       aci: OUR_ACI,
        //     },
        //   ],
        // }),
        // createMessage({
        //   from: CONTACT_A_PNI,
        //   details: [
        //     {
        //       type: 'member-add-from-invite',
        //       aci: CONTACT_A,
        //     },
        //   ],
        // }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('MemberAddFromInvited items', async () => {
      const firstBefore = createMessage(
        {
          from: OUR_PNI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: OUR_ACI,
              inviter: CONTACT_B,
            },
          ],
        },
        { sourceServiceId: OUR_ACI }
      );
      const firstAfter = createMessage(
        {
          from: OUR_ACI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: OUR_ACI,
              inviter: CONTACT_B,
            },
          ],
        },
        { disableIncrement: true }
      );

      const secondBefore = createMessage(
        {
          from: OUR_PNI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: OUR_ACI,
            },
          ],
        },
        { sourceServiceId: OUR_ACI }
      );
      const secondAfter = createMessage(
        {
          from: OUR_ACI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: OUR_ACI,
            },
          ],
        },
        { disableIncrement: true }
      );

      const thirdBefore = createMessage(
        {
          from: CONTACT_A_PNI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
            },
          ],
        },
        { sourceServiceId: CONTACT_A }
      );
      const thirdAfter = createMessage(
        {
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
            },
          ],
        },
        { disableIncrement: true }
      );

      const fourthBefore = createMessage(
        {
          from: CONTACT_A_PNI,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
              pni: CONTACT_A_PNI,
            },
          ],
        },
        { sourceServiceId: CONTACT_A }
      );
      const fourthAfter = createMessage(
        {
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-invite',
              aci: CONTACT_A,
            },
          ],
        },
        { disableIncrement: true }
      );

      const before = [firstBefore, secondBefore, thirdBefore, fourthBefore];
      const after = [firstAfter, secondAfter, thirdAfter, fourthAfter];

      await asymmetricRoundtripHarness(before, after);
    });

    it('MemberAddFromLink items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-add-from-link',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-add-from-link',
              aci: CONTACT_A,
            },
          ],
        }),
        // This doesn't roundtrip because if people join via link, they do it themselves.
        //   See the next test.
        // createMessage({
        //   details: [
        //     {
        //       type: 'member-add-from-link',
        //       aci: CONTACT_A,
        //     },
        //   ],
        // }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('MemberAddFromLink items asymmetric', async () => {
      const before: Array<MessageAttributesType> = [
        createMessage(
          {
            details: [
              {
                type: 'member-add-from-link',
                aci: CONTACT_A,
              },
            ],
          },
          { sourceServiceId: CONTACT_A }
        ),
      ];
      const after: Array<MessageAttributesType> = [
        createMessage(
          {
            from: CONTACT_A,
            details: [
              {
                type: 'member-add-from-link',
                aci: CONTACT_A,
              },
            ],
          },
          { disableIncrement: true }
        ),
      ];

      await asymmetricRoundtripHarness(before, after);
    });

    it('MemberAddFromAdminApproval items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'member-add-from-admin-approval',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-add-from-admin-approval',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-add-from-admin-approval',
              aci: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'member-add-from-admin-approval',
              aci: CONTACT_A,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-add-from-admin-approval',
              aci: CONTACT_A,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('MemberRemove items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-remove',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-remove',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-remove',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-remove',
              aci: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-remove',
              aci: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: CONTACT_B,
          details: [
            {
              type: 'member-remove',
              aci: CONTACT_A,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-remove',
              aci: CONTACT_A,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('MemberPrivilege items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-privilege',
              aci: OUR_ACI,
              newPrivilege: RoleEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-privilege',
              aci: OUR_ACI,
              newPrivilege: RoleEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-privilege',
              aci: CONTACT_A,
              newPrivilege: RoleEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'member-privilege',
              aci: CONTACT_A,
              newPrivilege: RoleEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-privilege',
              aci: CONTACT_A,
              newPrivilege: RoleEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'member-privilege',
              aci: OUR_ACI,
              newPrivilege: RoleEnum.DEFAULT,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-privilege',
              aci: OUR_ACI,
              newPrivilege: RoleEnum.DEFAULT,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'member-privilege',
              aci: CONTACT_A,
              newPrivilege: RoleEnum.DEFAULT,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'member-privilege',
              aci: CONTACT_A,
              newPrivilege: RoleEnum.DEFAULT,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'member-privilege',
              aci: CONTACT_A,
              newPrivilege: RoleEnum.DEFAULT,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('PendingAddOne items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'pending-add-one',
              serviceId: OUR_ACI,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-add-one',
              serviceId: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-add-one',
              serviceId: INVITEE_A,
            },
          ],
        }),
        // These don't roundtrip because we only have details if we're involved. See the
        //   next test.
        // createMessage({
        //   from: CONTACT_B,
        //   details: [
        //     {
        //       type: 'pending-add-one',
        //       serviceId: INVITEE_A,
        //     },
        //   ],
        // }),
        // createMessage({
        //   details: [
        //     {
        //       type: 'pending-add-one',
        //       serviceId: INVITEE_A,
        //     },
        //   ],
        // }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('PendingAddOne items, asymmetric', async () => {
      const firstBefore = createMessage({
        from: CONTACT_B,
        details: [
          {
            type: 'pending-add-one',
            serviceId: INVITEE_A,
          },
        ],
      });
      const firstAfter = createMessage(
        {
          from: CONTACT_B,
          details: [
            {
              type: 'pending-add-many',
              count: 1,
            },
          ],
        },
        { disableIncrement: true }
      );

      const secondBefore = createMessage({
        details: [
          {
            type: 'pending-add-one',
            serviceId: INVITEE_A,
          },
        ],
      });
      const secondAfter = createMessage(
        {
          details: [
            {
              type: 'pending-add-many',
              count: 1,
            },
          ],
        },
        { disableIncrement: true }
      );

      const before = [firstBefore, secondBefore];
      const after = [firstAfter, secondAfter];
      await asymmetricRoundtripHarness(before, after);
    });

    it('PendingAddMany items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-add-many',
              count: 5,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-add-many',
              count: 1,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'pending-add-many',
              count: 5,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'pending-add-many',
              count: 1,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-add-many',
              count: 5,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-add-many',
              count: 1,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('PendingRemoveOne items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: INVITEE_A,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
              inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
              // Not roundtripped unless you were invited, or invitee said no to invite
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
              // Not roundtripped unless you were invited, or invitee said no to invite
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
              // Not roundtripped unless you were invited, or invitee said no to invite
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: INVITEE_A,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
            },
          ],
        }),
        createMessage({
          from: INVITEE_A,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
              inviter: CONTACT_B,
            },
          ],
        }),

        createMessage({
          from: CONTACT_B,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: OUR_ACI,
              // Not roundtripped unless you were invited, or invitee said no to invite
              // inviter: CONTACT_B,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: CONTACT_B,
              // Not roundtripped unless you were invited, or invitee said no to invite
              // inviter: CONTACT_A,
            },
          ],
        }),

        createMessage({
          from: CONTACT_C,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
              // Not roundtripped unless you were invited, or invitee said no to invite
              // inviter: CONTACT_B,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
              // Not roundtripped unless you were invited, or invitee said no to invite
              // inviter: CONTACT_B,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
              // Not roundtripped unless you were invited, or invitee said no to invite
              // inviter: CONTACT_B,
            },
          ],
        }),

        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
            },
          ],
        }),
        createMessage({
          from: CONTACT_B,
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-one',
              serviceId: INVITEE_A,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('PendingRemoveMany items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              // Inviter is not roundtripped for a multi-remove
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
              // Inviter is not roundtripped for a multi-remove
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              // Inviter is not roundtripped for a multi-remove
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
              // Inviter is not roundtripped for a multi-remove
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              // Inviter is not roundtripped for a multi-remove
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
              // Inviter is not roundtripped for a multi-remove
              // inviter: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              // Inviter is not roundtripped for a multi-remove
              // inviter: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
              // Inviter is not roundtripped for a multi-remove
              // inviter: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              // Inviter is not roundtripped for a multi-remove
              // inviter: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
              // Inviter is not roundtripped for a multi-remove
              // inviter: CONTACT_A,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
              // Inviter is not roundtripped for a multi-remove
              // inviter: CONTACT_A,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
              // Inviter is not roundtripped for a multi-remove
              // inviter: CONTACT_A,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
            },
          ],
        }),

        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-many',
              count: 5,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'pending-remove-many',
              count: 1,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('AdminApprovalAdd items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'admin-approval-add-one',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-add-one',
              aci: CONTACT_A,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('AdminApprovalRemove items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'admin-approval-remove-one',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'admin-approval-remove-one',
              aci: OUR_ACI,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'admin-approval-remove-one',
              aci: CONTACT_A,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('AdminApprovalBounce items', async () => {
      const messages: Array<MessageAttributesType> = [
        // Should show button:
        createMessage({
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
        }),
        // These don't roundtrip, because we assume these always come from the requestor
        // createMessage({
        //   // From nobody
        //   details: [
        //     {
        //       type: 'admin-approval-bounce',
        //       aci: CONTACT_A,
        //       times: 1,
        //       isApprovalPending: false,
        //     },
        //   ],
        // }),
        // createMessage({
        //   details: [
        //     {
        //       type: 'admin-approval-bounce',
        //       aci: CONTACT_A,
        //       times: 1,
        //       isApprovalPending: false,
        //     },
        //     // No group membership info
        //   ],
        // }),
        // Would show button, but we're not admin:
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        }),
        // Would show button, but user is a group member:
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        }),
        // Would show button, but user is already banned:
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 1,
              isApprovalPending: false,
            },
          ],
        }),
        // Open request
        createMessage({
          from: CONTACT_A,
          details: [
            {
              type: 'admin-approval-bounce',
              aci: CONTACT_A,
              times: 4,
              isApprovalPending: true,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('GroupLinkAdd items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'group-link-add',
              privilege: AccessControlEnum.ANY,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'group-link-add',
              privilege: AccessControlEnum.ANY,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'group-link-add',
              privilege: AccessControlEnum.ANY,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'group-link-add',
              privilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'group-link-add',
              privilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'group-link-add',
              privilege: AccessControlEnum.ADMINISTRATOR,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('GroupLinkReset items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'group-link-reset',
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'group-link-reset',
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'group-link-reset',
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('GroupLinkRemove items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'group-link-remove',
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'group-link-remove',
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'group-link-remove',
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('DescriptionRemove items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              removed: true,
              type: 'description',
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              removed: true,
              type: 'description',
            },
          ],
        }),
        createMessage({
          details: [
            {
              removed: true,
              type: 'description',
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('DescriptionChange items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'description',
              description:
                'This is a long description.\n\nWe need a dialog to view it all!\n\nIt has a link to https://example.com',
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'description',
              description:
                'This is a long description.\n\nWe need a dialog to view it all!\n\nIt has a link to https://example.com',
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'description',
              description:
                'This is a long description.\n\nWe need a dialog to view it all!\n\nIt has a link to https://example.com',
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('DescriptionChange items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'announcements-only',
              announcementsOnly: true,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'announcements-only',
              announcementsOnly: true,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'announcements-only',
              announcementsOnly: true,
            },
          ],
        }),
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'announcements-only',
              announcementsOnly: false,
            },
          ],
        }),
        createMessage({
          from: ADMIN_A,
          details: [
            {
              type: 'announcements-only',
              announcementsOnly: false,
            },
          ],
        }),
        createMessage({
          details: [
            {
              type: 'announcements-only',
              announcementsOnly: false,
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('Summary items', async () => {
      const messages: Array<MessageAttributesType> = [
        createMessage({
          from: OUR_ACI,
          details: [
            {
              type: 'summary',
            },
          ],
        }),
      ];

      await symmetricRoundtripHarness(messages);
    });
  });

  describe('roundtrips given a timer change notification', () => {
    it('in a group', async () => {
      const groupConversation = window.ConversationController.get(GROUP_ID);
      strictAssert(
        groupConversation,
        'The group conversation must be created!'
      );

      counter += 1;
      const zeroTimer = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromSeconds(5),
          sourceServiceId: CONTACT_A,
        },
        flags: EXPIRATION_TIMER_FLAG,
        type: 'timer-notification' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
        source: CONTACT_A_E164,
      };

      counter += 1;
      const fiveSecondTimer = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromSeconds(5),
          sourceServiceId: CONTACT_A,
        },
        flags: EXPIRATION_TIMER_FLAG,
        type: 'timer-notification' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: CONTACT_A,
        source: CONTACT_A_E164,
      };

      const messages: Array<MessageAttributesType> = [
        zeroTimer,
        fiveSecondTimer,
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('in a 1:1 conversation', async () => {
      const contactA = window.ConversationController.get(CONTACT_A);
      strictAssert(contactA, 'contactA conversation must be created!');

      counter += 1;
      const zeroTimer = {
        id: generateGuid(),
        conversationId: contactA.id,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromSeconds(0),
          sourceServiceId: CONTACT_A,
        },
        sourceServiceId: CONTACT_A,
        source: CONTACT_A_E164,
        flags: EXPIRATION_TIMER_FLAG,
        type: 'timer-notification' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
      };

      counter += 1;
      const fiveSecondTimer = {
        id: generateGuid(),
        conversationId: contactA.id,
        expirationTimerUpdate: {
          expireTimer: DurationInSeconds.fromSeconds(5),
          sourceServiceId: OUR_ACI,
        },
        sourceServiceId: OUR_ACI,
        flags: EXPIRATION_TIMER_FLAG,
        type: 'timer-notification' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
      };

      const messages: Array<MessageAttributesType> = [
        zeroTimer,
        fiveSecondTimer,
      ];

      await symmetricRoundtripHarness(messages);
    });
  });

  describe('roundtrips given migration notifications', () => {
    it('symmetrically', async () => {
      const groupConversation = window.ConversationController.get(GROUP_ID);
      strictAssert(
        groupConversation,
        'The group conversation must be created!'
      );

      counter += 1;
      const droppedOnly = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        groupMigration: {
          areWeInvited: false,
          droppedMemberCount: 2,
          invitedMemberCount: 0,
        },
        type: 'group-v1-migration' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: OUR_ACI,
      };

      counter += 1;
      const invitedOnly = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        groupMigration: {
          areWeInvited: false,
          droppedMemberCount: 0,
          invitedMemberCount: 1,
        },
        type: 'group-v1-migration' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: OUR_ACI,
      };

      counter += 1;
      const bothAndInvited = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        groupMigration: {
          areWeInvited: true,
          droppedMemberCount: 2,
          invitedMemberCount: 1,
        },
        type: 'group-v1-migration' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: OUR_ACI,
      };

      const messages: Array<MessageAttributesType> = [
        droppedOnly,
        invitedOnly,
        bothAndInvited,
      ];

      await symmetricRoundtripHarness(messages);
    });

    it('asymmetrically', async () => {
      const groupConversation = window.ConversationController.get(GROUP_ID);
      strictAssert(
        groupConversation,
        'The group conversation must be created!'
      );

      counter += 1;
      const legacyBefore = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        droppedGV2MemberIds: [CONTACT_C],
        invitedGV2Members: [
          { uuid: CONTACT_A, timestamp: counter, role: RoleEnum.DEFAULT },
          { uuid: CONTACT_B, timestamp: counter, role: RoleEnum.DEFAULT },
        ],
        type: 'group-v1-migration' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: OUR_ACI,
      };
      const legacyAfter = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        groupMigration: {
          areWeInvited: false,
          droppedMemberCount: 1,
          invitedMemberCount: 2,
        },
        type: 'group-v1-migration' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: OUR_ACI,
      };

      counter += 1;
      const allDataBefore = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        groupMigration: {
          areWeInvited: true,
          droppedMemberIds: [CONTACT_C],
          invitedMembers: [
            { uuid: CONTACT_A, timestamp: counter, role: RoleEnum.DEFAULT },
            { uuid: CONTACT_B, timestamp: counter, role: RoleEnum.DEFAULT },
          ],
        },
        type: 'group-v1-migration' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: OUR_ACI,
      };
      const allDataAfter = {
        id: generateGuid(),
        conversationId: groupConversation.id,
        groupMigration: {
          areWeInvited: true,
          droppedMemberCount: 1,
          invitedMemberCount: 2,
        },
        type: 'group-v1-migration' as const,
        received_at: counter,
        sent_at: counter,
        timestamp: counter,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
        sourceServiceId: OUR_ACI,
      };

      const before = [legacyBefore, allDataBefore];
      const after = [legacyAfter, allDataAfter];

      await asymmetricRoundtripHarness(before, after);
    });
  });
});
