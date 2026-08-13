// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Bytes from '../../Bytes.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { isAciString } from '../../util/isAciString.std.ts';
import { isSignalServiceId } from '../../types/SignalConversation.std.ts';
import { isNotNil } from '../../util/isNotNil.std.ts';

import type { StorageInterface } from '../../types/Storage.d.ts';
import type { AciString, ServiceIdString } from '../../types/ServiceId.std.ts';
import type {
  BlockedGroup,
  BlockedNumber,
  BlockedServiceId,
} from '../../types/StorageKeys.std.ts';

const log = createLogger('Blocked');

const BLOCKED_NUMBERS_ID = 'blocked';
export const BLOCKED_UUIDS_ID = 'blocked-uuids';
const BLOCKED_GROUPS_ID = 'blocked-groups';
const RELEASE_NOTES_CHAT_BLOCKED_ID = 'releaseNotesChatBlocked';
const RELEASE_NOTES_CHAT_BLOCKED_AT_ID = 'releaseNotesChatBlockedAt';

export class Blocked {
  readonly #storage: StorageInterface;

  readonly #blockedNumbers: Map<string, BlockedNumber>;
  readonly #blockedServiceIds: Map<string, BlockedServiceId>;
  readonly #blockedGroups: Map<string, BlockedGroup>;

  constructor(storage: StorageInterface) {
    this.#storage = storage;

    this.#blockedNumbers = new Map();
    this.#blockedServiceIds = new Map();
    this.#blockedGroups = new Map();

    this.load();
  }

  public reset(): void {
    this.#blockedNumbers.clear();
    this.#blockedServiceIds.clear();
    this.#blockedGroups.clear();
  }

  public load(): void {
    this.setBlockedNumbers();
    this.setBlockedServiceIds();
    this.setBlockedGroups();
  }

  public setBlockedNumbers(): void {
    const array = this.#storage.get(BLOCKED_NUMBERS_ID);
    this.#blockedNumbers.clear();
    array?.forEach(item => {
      this.#blockedNumbers.set(item.e164, item);
    });
  }
  public getBlockedNumbers(): ReadonlyMap<string, BlockedNumber> {
    return this.#blockedNumbers;
  }

  public isBlocked(e164: string): boolean {
    return Boolean(this.#blockedNumbers.get(e164));
  }

  public async addBlockedNumber(
    e164: string,
    blockedAt: number | undefined
  ): Promise<void> {
    if (this.isBlocked(e164)) {
      return;
    }

    log.info('adding', e164, 'to blocked list');

    const data = { e164, blockedAt };
    this.#blockedNumbers.set(e164, data);

    const array = this.#storage.get(BLOCKED_NUMBERS_ID);
    await this.#storage.put(BLOCKED_NUMBERS_ID, (array || []).concat(data));
  }

  public async removeBlockedNumber(e164: string): Promise<void> {
    if (!this.isBlocked(e164)) {
      return;
    }

    log.info('removing', e164, 'from blocked list');

    this.#blockedNumbers.delete(e164);

    const array = this.#storage.get(BLOCKED_NUMBERS_ID);
    await this.#storage.put(
      BLOCKED_NUMBERS_ID,
      (array || []).filter(item => item.e164 !== e164)
    );
  }

  public setBlockedServiceIds(): void {
    const array = this.#storage.get(BLOCKED_UUIDS_ID);
    this.#blockedServiceIds.clear();
    array?.forEach(item => {
      this.#blockedServiceIds.set(item.serviceId, item);
    });
  }
  public getBlockedServiceIds(): ReadonlyMap<string, BlockedServiceId> {
    return this.#blockedServiceIds;
  }

  public isServiceIdBlocked(serviceId: ServiceIdString): boolean {
    return Boolean(this.#blockedServiceIds.get(serviceId));
  }

  public async addBlockedServiceId(
    serviceId: ServiceIdString,
    blockedAt: number | undefined
  ): Promise<void> {
    if (isSignalServiceId(serviceId)) {
      log.error('Attempting to block release notes chat by serviceId');
      return;
    }

    if (this.isServiceIdBlocked(serviceId)) {
      return;
    }

    log.info('adding', serviceId, 'to blocked list');

    const data = { serviceId, blockedAt };
    this.#blockedServiceIds.set(serviceId, data);

    const array = this.#storage.get(BLOCKED_UUIDS_ID);
    await this.#storage.put(BLOCKED_UUIDS_ID, (array || []).concat(data));
  }

  public async removeBlockedServiceId(
    serviceId: ServiceIdString
  ): Promise<void> {
    if (isSignalServiceId(serviceId)) {
      log.error('Attempting to unblock release notes chat by serviceId');
      return;
    }

    if (!this.isServiceIdBlocked(serviceId)) {
      return;
    }

    log.info('removing', serviceId, 'from blocked list');

    this.#blockedServiceIds.delete(serviceId);

    const array = this.#storage.get(BLOCKED_UUIDS_ID);
    await this.#storage.put(
      BLOCKED_UUIDS_ID,
      (array || []).filter(item => item.serviceId !== serviceId)
    );
  }

  public isReleaseNotesChatBlocked(): boolean {
    return this.#storage.get(RELEASE_NOTES_CHAT_BLOCKED_ID, false);
  }
  public whenWasReleaseNotesChatBlocked(): number | undefined {
    return this.#storage.get(RELEASE_NOTES_CHAT_BLOCKED_AT_ID, undefined);
  }

  public async setReleaseNotesChatBlocked(
    blocked: boolean,
    blockedAt: number | undefined
  ): Promise<void> {
    await this.#storage.put(RELEASE_NOTES_CHAT_BLOCKED_ID, blocked);
    await this.#storage.put(
      RELEASE_NOTES_CHAT_BLOCKED_AT_ID,
      blocked ? blockedAt : undefined
    );
  }

  public setBlockedGroups(): void {
    const array = this.#storage.get(BLOCKED_GROUPS_ID);
    this.#blockedGroups.clear();
    array?.forEach(item => {
      this.#blockedGroups.set(item.groupId, item);
    });
  }
  public getBlockedGroups(): ReadonlyMap<string, BlockedGroup> {
    return this.#blockedGroups;
  }

  public isGroupBlocked(groupId: string): boolean {
    return Boolean(this.#blockedGroups.get(groupId));
  }

  public async addBlockedGroup(
    groupId: string,
    blockedAt: number | undefined
  ): Promise<void> {
    if (this.isGroupBlocked(groupId)) {
      return;
    }

    log.info(`adding group(${groupId}) to blocked list`);

    const data = { groupId, blockedAt };
    this.#blockedGroups.set(groupId, data);

    const array = this.#storage.get(BLOCKED_GROUPS_ID);
    await this.#storage.put(BLOCKED_GROUPS_ID, (array || []).concat(data));
  }

  public async removeBlockedGroup(groupId: string): Promise<void> {
    if (!this.isGroupBlocked(groupId)) {
      return;
    }

    log.info(`removing group(${groupId} from blocked list`);

    this.#blockedGroups.delete(groupId);

    const array = this.#storage.get(BLOCKED_GROUPS_ID);
    await this.#storage.put(
      BLOCKED_GROUPS_ID,
      (array || []).filter(item => item.groupId !== groupId)
    );
  }

  public getBlockedData(): {
    e164s: ReadonlyArray<BlockedNumber>;
    acis: ReadonlyArray<{
      blockedAt: number | undefined;
      aci: AciString;
    }>;
    groupIds: ReadonlyArray<{
      blockedAt: number | undefined;
      groupId: Uint8Array<ArrayBuffer>;
    }>;
  } {
    const e164s = Array.from(this.getBlockedNumbers().values());
    const acis = Array.from(this.getBlockedServiceIds().values())
      .map(item => {
        if (!isAciString(item.serviceId)) {
          return undefined;
        }

        return {
          blockedAt: item.blockedAt,
          aci: item.serviceId,
        };
      })
      .filter(isNotNil);
    const groupIds = Array.from(this.getBlockedGroups().values()).map(item => ({
      ...item,
      groupId: Bytes.fromBase64(item.groupId),
    }));

    return {
      e164s,
      acis,
      groupIds,
    };
  }
}
