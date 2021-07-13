// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { StorageInterface } from '../../types/Storage.d';

import Helpers from '../Helpers';

export class User {
  constructor(private readonly storage: StorageInterface) {}

  public async setNumberAndDeviceId(
    number: string,
    deviceId: number,
    deviceName?: string
  ): Promise<void> {
    await this.storage.put('number_id', `${number}.${deviceId}`);
    if (deviceName) {
      await this.storage.put('device_name', deviceName);
    }
  }

  public async setUuidAndDeviceId(
    uuid: string,
    deviceId: number
  ): Promise<void> {
    return this.storage.put('uuid_id', `${uuid}.${deviceId}`);
  }

  public getNumber(): string | undefined {
    const numberId = this.storage.get('number_id');
    if (numberId === undefined) return undefined;
    return Helpers.unencodeNumber(numberId)[0];
  }

  public getUuid(): string | undefined {
    const uuid = this.storage.get('uuid_id');
    if (uuid === undefined) return undefined;
    return Helpers.unencodeNumber(uuid.toLowerCase())[0];
  }

  public getDeviceId(): number | undefined {
    const value = this._getDeviceIdFromUuid() || this._getDeviceIdFromNumber();
    if (value === undefined) {
      return undefined;
    }
    return parseInt(value, 10);
  }

  public getDeviceName(): string | undefined {
    return this.storage.get('device_name');
  }

  public async setDeviceNameEncrypted(): Promise<void> {
    return this.storage.put('deviceNameEncrypted', true);
  }

  public getDeviceNameEncrypted(): boolean | undefined {
    return this.storage.get('deviceNameEncrypted');
  }

  public getSignalingKey(): ArrayBuffer | undefined {
    return this.storage.get('signaling_key');
  }

  private _getDeviceIdFromUuid(): string | undefined {
    const uuid = this.storage.get('uuid_id');
    if (uuid === undefined) return undefined;
    return Helpers.unencodeNumber(uuid)[1];
  }

  private _getDeviceIdFromNumber(): string | undefined {
    const numberId = this.storage.get('number_id');
    if (numberId === undefined) return undefined;
    return Helpers.unencodeNumber(numberId)[1];
  }
}
