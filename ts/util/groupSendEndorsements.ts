// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { Aci } from '@signalapp/libsignal-client';
import {
  groupSendEndorsementsDataSchema,
  type GroupSendEndorsementsData,
} from '../types/GroupSendEndorsements';
import { strictAssert } from './assert';
import {
  GroupSecretParams,
  GroupSendEndorsementsResponse,
  ServerPublicParams,
} from './zkgroup';
import { fromAciObject } from '../types/ServiceId';
import * as log from '../logging/log';
import type { GroupV2MemberType } from '../model-types';

export function decodeGroupSendEndorsementResponse({
  groupId,
  groupSendEndorsementResponse,
  groupSecretParamsBase64,
  groupMembersV2,
}: {
  groupId: string;
  groupSendEndorsementResponse: Uint8Array;
  groupSecretParamsBase64: string;
  groupMembersV2: ReadonlyArray<GroupV2MemberType>;
}): GroupSendEndorsementsData {
  const idForLogging = `groupV2(${groupId})`;

  strictAssert(
    groupSendEndorsementResponse != null,
    'Missing groupSendEndorsementResponse'
  );

  strictAssert(
    groupSendEndorsementResponse.byteLength > 0,
    'Received empty groupSendEndorsementResponse'
  );

  const response = new GroupSendEndorsementsResponse(
    Buffer.from(groupSendEndorsementResponse)
  );

  const expiration = response.getExpiration().getTime();

  const localUser = Aci.parseFromServiceIdString(
    window.textsecure.storage.user.getCheckedAci()
  );

  const groupSecretParams = new GroupSecretParams(
    Buffer.from(groupSecretParamsBase64, 'base64')
  );

  const serverPublicParams = new ServerPublicParams(
    Buffer.from(window.getServerPublicParams(), 'base64')
  );

  const groupMembers = groupMembersV2.map(member => {
    return Aci.parseFromServiceIdString(member.aci);
  });

  const receivedEndorsements = response.receiveWithServiceIds(
    groupMembers,
    localUser,
    groupSecretParams,
    serverPublicParams
  );

  const { combinedEndorsement, endorsements } = receivedEndorsements;

  strictAssert(
    endorsements.length === groupMembers.length,
    `Member endorsements must match input array (expected: ${groupMembers.length}, actual: ${endorsements.length})`
  );

  log.info(
    `decodeGroupSendEndorsementResponse: Received endorsements (group: ${idForLogging}, expiration: ${expiration}, members: ${groupMembers.length})`
  );

  const groupEndorsementData: GroupSendEndorsementsData = {
    combinedEndorsement: {
      groupId,
      expiration,
      endorsement: combinedEndorsement.getContents(),
    },
    memberEndorsements: groupMembers.map((groupMember, index) => {
      const endorsement = endorsements.at(index);
      strictAssert(
        endorsement != null,
        `Missing endorsement at index ${index}`
      );
      return {
        groupId,
        memberAci: fromAciObject(groupMember),
        expiration,
        endorsement: endorsement.getContents(),
      };
    }),
  };

  return groupSendEndorsementsDataSchema.parse(groupEndorsementData);
}
