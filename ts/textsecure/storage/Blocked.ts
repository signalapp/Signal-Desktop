// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { without } from 'lodash';

import * as log from '../../logging/log';
import * as Bytes from '../../Bytes';
import { isAciString } from '../../util/isAciString';
import type { StorageInterface } from '../../types/Storage.d';
import type { AciString, ServiceIdString } from '../../types/ServiceId';

export const BLOCKED_NUMBERS_ID = 'blocked';
export const BLOCKED_UUIDS_ID = 'blocked-uuids';
export const BLOCKED_GROUPS_ID = 'blocked-groups';

export class Blocked {
  constructor(private readonly storage: StorageInterface) {}

  public getBlockedNumbers(): Array<string> {
    return this.storage.get(BLOCKED_NUMBERS_ID, new Array<string>());
  }

  public isBlocked(number: string): boolean {
    return this.getBlockedNumbers().includes(number);
  }

  public async addBlockedNumber(number: string): Promise<void> {
    const numbers = this.getBlockedNumbers();
    if (numbers.includes(number)) {
      return;
    }

    log.info('adding', number, 'to blocked list');
    await this.storage.put(BLOCKED_NUMBERS_ID, numbers.concat(number));
  }

  public async removeBlockedNumber(number: string): Promise<void> {
    const numbers = this.getBlockedNumbers();
    if (!numbers.includes(number)) {
      return;
    }

    log.info('removing', number, 'from blocked list');
    await this.storage.put(BLOCKED_NUMBERS_ID, without(numbers, number));
  }

  public getBlockedServiceIds(): Array<ServiceIdString> {
    return this.storage.get(BLOCKED_UUIDS_ID, new Array<ServiceIdString>());
  }

  public isServiceIdBlocked(serviceId: ServiceIdString): boolean {
    return this.getBlockedServiceIds().includes(serviceId);
  }

  public async addBlockedServiceId(serviceId: ServiceIdString): Promise<void> {
    const serviceIds = this.getBlockedServiceIds();
    if (serviceIds.includes(serviceId)) {
      return;
    }

    log.info('adding', serviceId, 'to blocked list');
    await this.storage.put(BLOCKED_UUIDS_ID, serviceIds.concat(serviceId));
  }

  public async removeBlockedServiceId(
    serviceId: ServiceIdString
  ): Promise<void> {
    const numbers = this.getBlockedServiceIds();
    if (!numbers.includes(serviceId)) {
      return;
    }

    log.info('removing', serviceId, 'from blocked list');
    await this.storage.put(BLOCKED_UUIDS_ID, without(numbers, serviceId));
  }

  public getBlockedGroups(): Array<string> {
    return this.storage.get(BLOCKED_GROUPS_ID, new Array<string>());
  }

  public isGroupBlocked(groupId: string): boolean {
    return this.getBlockedGroups().includes(groupId);
  }

  public async addBlockedGroup(groupId: string): Promise<void> {
    const groupIds = this.getBlockedGroups();
    if (groupIds.includes(groupId)) {
      return;
    }

    log.info(`adding group(${groupId}) to blocked list`);
    await this.storage.put(BLOCKED_GROUPS_ID, groupIds.concat(groupId));
  }

  public async removeBlockedGroup(groupId: string): Promise<void> {
    const groupIds = this.getBlockedGroups();
    if (!groupIds.includes(groupId)) {
      return;
    }

    log.info(`removing group(${groupId} from blocked list`);
    await this.storage.put(BLOCKED_GROUPS_ID, without(groupIds, groupId));
  }

  public getBlockedData(): {
    e164s: Array<string>;
    acis: Array<AciString>;
    groupIds: Array<Uint8Array>;
  } {
    const e164s = this.getBlockedNumbers();
    const acis = this.getBlockedServiceIds().filter(item => isAciString(item));
    const groupIds = this.getBlockedGroups().map(item =>
      Bytes.fromBase64(item)
    );

    return {
      e164s,
      acis,
      groupIds,
    };
  }
}
