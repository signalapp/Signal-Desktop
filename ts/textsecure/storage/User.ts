// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAPICredentials } from '../Types.d';

import { strictAssert } from '../../util/assert';
import type { StorageInterface } from '../../types/Storage.d';
import { UUID, UUIDKind } from '../../types/UUID';
import * as log from '../../logging/log';

import Helpers from '../Helpers';

export type SetCredentialsOptions = {
  uuid: string;
  pni: string;
  number: string;
  deviceId: number;
  deviceName?: string;
  password: string;
};

export class User {
  constructor(private readonly storage: StorageInterface) {}

  public async setUuidAndDeviceId(
    uuid: string,
    deviceId: number
  ): Promise<void> {
    await this.storage.put('uuid_id', `${uuid}.${deviceId}`);

    log.info('storage.user: uuid and device id changed');
  }

  public async setNumber(number: string): Promise<void> {
    if (this.getNumber() === number) {
      return;
    }

    const deviceId = this.getDeviceId();
    strictAssert(
      deviceId !== undefined,
      'Cannot update device number without knowing device id'
    );

    log.info('storage.user: number changed');

    await Promise.all([
      this.storage.put('number_id', `${number}.${deviceId}`),
      this.storage.remove('senderCertificate'),
    ]);

    // Notify redux about phone number change
    window.Whisper.events.trigger('userChanged', true);
  }

  public getNumber(): string | undefined {
    const numberId = this.storage.get('number_id');
    if (numberId === undefined) return undefined;
    return Helpers.unencodeNumber(numberId)[0];
  }

  public getUuid(uuidKind = UUIDKind.ACI): UUID | undefined {
    if (uuidKind === UUIDKind.PNI) {
      const pni = this.storage.get('pni');
      if (pni === undefined) return undefined;
      return new UUID(pni);
    }

    strictAssert(
      uuidKind === UUIDKind.ACI,
      `Unsupported uuid kind: ${uuidKind}`
    );
    const uuid = this.storage.get('uuid_id');
    if (!uuid) return undefined;
    return new UUID(Helpers.unencodeNumber(uuid.toLowerCase())[0]);
  }

  public getCheckedUuid(uuidKind?: UUIDKind): UUID {
    const uuid = this.getUuid(uuidKind);
    strictAssert(uuid !== undefined, 'Must have our own uuid');
    return uuid;
  }

  public async setPni(pni: string): Promise<void> {
    await this.storage.put('pni', UUID.cast(pni));
  }

  public getOurUuidKind(uuid: UUID): UUIDKind {
    const ourUuid = this.getUuid();

    if (ourUuid?.toString() === uuid.toString()) {
      return UUIDKind.ACI;
    }

    const pni = this.getUuid(UUIDKind.PNI);
    if (pni?.toString() === uuid.toString()) {
      return UUIDKind.PNI;
    }

    return UUIDKind.Unknown;
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

  public async removeSignalingKey(): Promise<void> {
    return this.storage.remove('signaling_key');
  }

  public async setCredentials(
    credentials: SetCredentialsOptions
  ): Promise<void> {
    const { uuid, pni, number, deviceId, deviceName, password } = credentials;

    await Promise.all([
      this.storage.put('number_id', `${number}.${deviceId}`),
      this.storage.put('uuid_id', `${uuid}.${deviceId}`),
      this.storage.put('password', password),
      this.setPni(pni),
      deviceName
        ? this.storage.put('device_name', deviceName)
        : Promise.resolve(),
    ]);
  }

  public async removeCredentials(): Promise<void> {
    log.info('storage.user: removeCredentials');

    await Promise.all([
      this.storage.remove('number_id'),
      this.storage.remove('uuid_id'),
      this.storage.remove('password'),
      this.storage.remove('device_name'),
    ]);
  }

  public getWebAPICredentials(): WebAPICredentials {
    return {
      username:
        this.storage.get('uuid_id') || this.storage.get('number_id') || '',
      password: this.storage.get('password', ''),
    };
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
