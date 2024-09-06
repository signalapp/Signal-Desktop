// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { Aci } from '@signalapp/libsignal-client';
import type {
  GroupSendCombinedEndorsementRecord,
  GroupSendMemberEndorsementRecord,
  GroupSendToken,
} from '../types/GroupSendEndorsements';
import {
  groupSendEndorsementsDataSchema,
  toGroupSendToken,
  type GroupSendEndorsementsData,
} from '../types/GroupSendEndorsements';
import { assertDev, strictAssert } from './assert';
import {
  GroupSecretParams,
  GroupSendEndorsement,
  GroupSendEndorsementsResponse,
  ServerPublicParams,
} from './zkgroup';
import type { AciString, ServiceIdString } from '../types/ServiceId';
import { fromAciObject } from '../types/ServiceId';
import * as log from '../logging/log';
import type { GroupV2MemberType } from '../model-types';
import { DurationInSeconds } from './durations';
import { ToastType } from '../types/Toast';
import * as Errors from '../types/errors';

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
  const idForLogging = `groupv2(${groupId})`;

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

  const expiration = response.getExpiration().getTime() / 1000;

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

  const groupEndorsementsData: GroupSendEndorsementsData = {
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

  return groupSendEndorsementsDataSchema.parse(groupEndorsementsData);
}

const TWO_DAYS = DurationInSeconds.fromDays(2);
const TWO_HOURS = DurationInSeconds.fromHours(2);

export function isValidGroupSendEndorsementsExpiration(
  expiration: number
): boolean {
  const expSeconds = DurationInSeconds.fromMillis(expiration);
  const nowSeconds = DurationInSeconds.fromMillis(Date.now());
  const distance = Math.trunc(expSeconds - nowSeconds);
  return distance <= TWO_DAYS && distance > TWO_HOURS;
}

export class GroupSendEndorsementState {
  #combinedEndorsement: GroupSendCombinedEndorsementRecord;
  #memberEndorsements = new Map<
    ServiceIdString,
    GroupSendMemberEndorsementRecord
  >();
  #memberEndorsementsAcis = new Set<AciString>();
  #groupSecretParamsBase64: string;
  #endorsementCache = new WeakMap<Uint8Array, GroupSendEndorsement>();

  constructor(
    data: GroupSendEndorsementsData,
    groupSecretParamsBase64: string
  ) {
    this.#combinedEndorsement = data.combinedEndorsement;
    for (const endorsement of data.memberEndorsements) {
      this.#memberEndorsements.set(endorsement.memberAci, endorsement);
      this.#memberEndorsementsAcis.add(endorsement.memberAci);
    }
    this.#groupSecretParamsBase64 = groupSecretParamsBase64;
  }

  isSafeExpirationRange(): boolean {
    return isValidGroupSendEndorsementsExpiration(
      this.getExpiration().getTime()
    );
  }

  getExpiration(): Date {
    return new Date(this.#combinedEndorsement.expiration * 1000);
  }

  hasMember(serviceId: ServiceIdString): boolean {
    return this.#memberEndorsements.has(serviceId);
  }

  #toEndorsement(contents: Uint8Array) {
    let endorsement = this.#endorsementCache.get(contents);
    if (endorsement == null) {
      endorsement = new GroupSendEndorsement(Buffer.from(contents));
      this.#endorsementCache.set(contents, endorsement);
    }
    return endorsement;
  }

  // Strategy 1: Faster when we're sending to most of the group members
  // `combined.byRemoving(combine(difference(members, sends)))`
  #subtractMemberEndorsements(
    serviceIds: Set<ServiceIdString>
  ): GroupSendEndorsement {
    const difference = this.#memberEndorsementsAcis.difference(serviceIds);
    const ourAci = window.textsecure.storage.user.getCheckedAci();

    const toRemove: Array<GroupSendEndorsement> = [];
    for (const serviceId of difference) {
      if (serviceId === ourAci) {
        // Note: Combined endorsement does not include our aci
        continue;
      }

      const memberEndorsement = this.#memberEndorsements.get(serviceId);
      strictAssert(
        memberEndorsement,
        'serializeGroupSendEndorsementFullToken: Missing endorsement'
      );
      toRemove.push(this.#toEndorsement(memberEndorsement.endorsement));
    }

    return this.#toEndorsement(
      this.#combinedEndorsement.endorsement
    ).byRemoving(GroupSendEndorsement.combine(toRemove));
  }

  // Strategy 2: Faster when we're not sending to most of the group members
  // `combine(sends)`
  #combineMemberEndorsements(
    serviceIds: Set<ServiceIdString>
  ): GroupSendEndorsement {
    const memberEndorsements = Array.from(serviceIds).map(serviceId => {
      const memberEndorsement = this.#memberEndorsements.get(serviceId);
      strictAssert(
        memberEndorsement,
        'serializeGroupSendEndorsementFullToken: Missing endorsement'
      );
      return this.#toEndorsement(memberEndorsement.endorsement);
    });

    return GroupSendEndorsement.combine(memberEndorsements);
  }

  buildToken(serviceIds: Set<ServiceIdString>): GroupSendToken {
    const sendCount = serviceIds.size;
    const memberCount = this.#memberEndorsements.size;
    const logId = `GroupSendEndorsementState.buildToken(${sendCount} of ${memberCount})`;

    let endorsement: GroupSendEndorsement;
    if (sendCount === memberCount - 1) {
      log.info(`${logId}: combinedEndorsement`);
      // Note: Combined endorsement does not include our aci
      endorsement = this.#toEndorsement(this.#combinedEndorsement.endorsement);
    } else if (sendCount > (memberCount - 1) / 2) {
      log.info(`${logId}: subtractMemberEndorsements`);
      endorsement = this.#subtractMemberEndorsements(serviceIds);
    } else {
      log.info(`${logId}: combineMemberEndorsements`);
      endorsement = this.#combineMemberEndorsements(serviceIds);
    }

    const groupSecretParams = new GroupSecretParams(
      Buffer.from(this.#groupSecretParamsBase64, 'base64')
    );

    const expiration = this.getExpiration();

    strictAssert(
      isValidGroupSendEndorsementsExpiration(expiration.getTime()),
      'Cannot build token with invalid expiration'
    );

    const fullToken = endorsement.toFullToken(groupSecretParams, expiration);
    return toGroupSendToken(fullToken.serialize());
  }
}

export function onFailedToSendWithEndorsements(error: Error): void {
  log.error('onFailedToSendWithEndorsements', Errors.toLogFormat(error));
  window.reduxActions.toast.showToast({
    toastType: ToastType.FailedToSendWithEndorsements,
  });
  assertDev(false, 'We should never fail to send with endorsements');
}
