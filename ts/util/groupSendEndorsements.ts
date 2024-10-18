// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { Aci } from '@signalapp/libsignal-client';
import { throttle } from 'lodash';
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
import { devDebugger, strictAssert } from './assert';
import {
  GroupSecretParams,
  GroupSendEndorsement,
  GroupSendEndorsementsResponse,
  ServerPublicParams,
} from './zkgroup';
import type { ServiceIdString } from '../types/ServiceId';
import { fromAciObject } from '../types/ServiceId';
import * as log from '../logging/log';
import type { GroupV2MemberType } from '../model-types';
import { DurationInSeconds, MINUTE } from './durations';
import { ToastType } from '../types/Toast';
import * as Errors from '../types/errors';
import { isTestOrMockEnvironment } from '../environment';
import { isAlpha } from './version';
import { parseStrict } from './schemas';
import { DataReader } from '../sql/Client';
import { maybeUpdateGroup } from '../groups';
import { isGroupV2 } from './whatTypeOfConversation';

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

  return parseStrict(groupSendEndorsementsDataSchema, {
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
  });
}

const TWO_DAYS = DurationInSeconds.fromDays(2);
const TWO_HOURS = DurationInSeconds.fromHours(2);

function logServiceIds(list: Iterable<string>) {
  const items = Array.from(list);
  if (items.length <= 5) {
    return items.join(', ');
  }
  return `${items.slice(0, 4).join(', ')}, and ${items.length - 4} others`;
}

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
  #memberEndorsementsAcis = new Set<ServiceIdString>();
  #groupSecretParamsBase64: string;
  #ourAci: ServiceIdString;
  #endorsementCache = new WeakMap<Uint8Array, GroupSendEndorsement>();

  constructor(
    data: GroupSendEndorsementsData,
    groupSecretParamsBase64: string
  ) {
    this.#combinedEndorsement = data.combinedEndorsement;
    this.#groupSecretParamsBase64 = groupSecretParamsBase64;
    this.#ourAci = window.textsecure.storage.user.getCheckedAci();
    for (const endorsement of data.memberEndorsements) {
      this.#memberEndorsements.set(endorsement.memberAci, endorsement);
      this.#memberEndorsementsAcis.add(endorsement.memberAci);
    }
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

  #toEndorsement(contents: Uint8Array): GroupSendEndorsement {
    let endorsement = this.#endorsementCache.get(contents);
    if (endorsement == null) {
      endorsement = new GroupSendEndorsement(Buffer.from(contents));
      this.#endorsementCache.set(contents, endorsement);
    }
    return endorsement;
  }

  #toToken(endorsement: GroupSendEndorsement): GroupSendToken {
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

  #getCombinedEndorsement(includesOurs: boolean) {
    const endorsement = this.#toEndorsement(
      this.#combinedEndorsement.endorsement
    );
    if (!includesOurs) {
      return endorsement;
    }
    return GroupSendEndorsement.combine([
      endorsement,
      this.#getMemberEndorsement(this.#ourAci),
    ]);
  }

  #getMemberEndorsement(serviceId: ServiceIdString) {
    const memberEndorsement = this.#memberEndorsements.get(serviceId);
    strictAssert(
      memberEndorsement,
      'subtractMemberEndorsements: Missing endorsement'
    );
    return this.#toEndorsement(memberEndorsement.endorsement);
  }

  // Strategy 1: Faster when we're sending to most of the group members
  // `combined.byRemoving(combine(difference(members, sends)))`
  #subtractMemberEndorsements(
    otherMembersServiceIds: Set<ServiceIdString>,
    includesOurs: boolean
  ): GroupSendEndorsement {
    strictAssert(
      !otherMembersServiceIds.has(this.#ourAci),
      'subtractMemberEndorsements: Cannot subtract our own aci from the combined endorsement'
    );
    return this.#getCombinedEndorsement(includesOurs).byRemoving(
      this.#combineMemberEndorsements(otherMembersServiceIds)
    );
  }

  // Strategy 2: Faster when we're not sending to most of the group members
  // `combine(sends)`
  #combineMemberEndorsements(
    serviceIds: Set<ServiceIdString>
  ): GroupSendEndorsement {
    return GroupSendEndorsement.combine(
      Array.from(serviceIds, serviceId => {
        return this.#getMemberEndorsement(serviceId);
      })
    );
  }

  #buildToken(serviceIds: Set<ServiceIdString>): GroupSendEndorsement {
    const sendCount = serviceIds.size;
    const memberCount = this.#memberEndorsements.size;
    const logId = `GroupSendEndorsementState.buildToken(${sendCount} of ${memberCount})`;

    // Fast path sending to one person
    if (serviceIds.size === 1) {
      const [serviceId] = serviceIds;
      log.info(`${logId}: using single member endorsement (${serviceId})`);
      return this.#getMemberEndorsement(serviceId);
    }

    const missing = serviceIds.difference(this.#memberEndorsementsAcis);
    if (missing.size !== 0) {
      throw new Error(
        `${logId}: Attempted to build token with memberAcis we don't have endorsements for (${logServiceIds(missing)})`
      );
    }

    const difference = this.#memberEndorsementsAcis.difference(serviceIds);
    log.info(
      `${logId}: Endorsements without sends ${difference.size}: ${logServiceIds(difference)}`
    );

    const otherMembers = new Set(difference);
    const includesOurs = !otherMembers.delete(this.#ourAci);

    if (otherMembers.size === 0) {
      log.info(
        `${logId}: using combined endorsement (includesOurs: ${includesOurs})`
      );
      return this.#getCombinedEndorsement(includesOurs);
    }

    if (otherMembers.size < memberCount / 2) {
      log.info(
        `${logId}: subtracting missing members (includesOurs: ${includesOurs})`
      );
      return this.#subtractMemberEndorsements(otherMembers, includesOurs);
    }

    log.info(`${logId}: combining all members`);
    return this.#combineMemberEndorsements(serviceIds);
  }

  buildToken(serviceIds: Set<ServiceIdString>): GroupSendToken | null {
    try {
      return this.#toToken(this.#buildToken(new Set(serviceIds)));
    } catch (error) {
      onFailedToSendWithEndorsements(error);
    }
    return null;
  }
}

const showFailedToSendWithEndorsementsToast = throttle(
  () => {
    window.reduxActions.toast.showToast({
      toastType: ToastType.FailedToSendWithEndorsements,
    });
  },
  5 * MINUTE,
  { trailing: false }
);

export function onFailedToSendWithEndorsements(error: Error): void {
  log.error('onFailedToSendWithEndorsements', Errors.toLogFormat(error));
  if (isTestOrMockEnvironment() || isAlpha(window.getVersion())) {
    showFailedToSendWithEndorsementsToast();
  }
  if (window.SignalCI) {
    window.SignalCI.handleEvent('fatalTestError', error);
  }
  devDebugger();
}

type MaybeCreateGroupSendEndorsementStateResult =
  | { state: GroupSendEndorsementState; didRefreshGroupState: false }
  | { state: null; didRefreshGroupState: boolean };

export async function maybeCreateGroupSendEndorsementState(
  groupId: string,
  alreadyRefreshedGroupState: boolean
): Promise<MaybeCreateGroupSendEndorsementStateResult> {
  const conversation = window.ConversationController.get(groupId);
  strictAssert(
    conversation != null,
    'maybeCreateGroupSendEndorsementState: Convertion not found'
  );

  const logId = `maybeCreateGroupSendEndorsementState/${conversation.idForLogging()}`;

  strictAssert(
    isGroupV2(conversation.attributes),
    `${logId}: Conversation is not groupV2`
  );

  const data = await DataReader.getGroupSendEndorsementsData(groupId);
  if (data == null) {
    const ourAci = window.textsecure.storage.user.getCheckedAci();
    if (conversation.isMember(ourAci)) {
      onFailedToSendWithEndorsements(
        new Error(`${logId}: Missing all endorsements for group`)
      );
    }
    return { state: null, didRefreshGroupState: false };
  }

  const groupSecretParamsBase64 = conversation.get('secretParams');
  strictAssert(groupSecretParamsBase64, `${logId}: Must have secret params`);

  const groupSendEndorsementState = new GroupSendEndorsementState(
    data,
    groupSecretParamsBase64
  );

  if (
    groupSendEndorsementState != null &&
    !groupSendEndorsementState.isSafeExpirationRange() &&
    !alreadyRefreshedGroupState
  ) {
    log.info(
      `${logId}: Endorsements close to expiration (${groupSendEndorsementState.getExpiration().getTime()}, ${Date.now()}), refreshing group`
    );
    await maybeUpdateGroup({ conversation });
    return { state: null, didRefreshGroupState: true };
  }

  return { state: groupSendEndorsementState, didRefreshGroupState: false };
}
