// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAPICredentials } from '../Types.d';

import { strictAssert } from '../../util/assert';
import type { StorageInterface } from '../../types/Storage.d';
import type {
  AciString,
  PniString,
  ServiceIdString,
} from '../../types/ServiceId';
import { ServiceIdKind, isPniString } from '../../types/ServiceId';
import { isAciString } from '../../util/isAciString';
import * as log from '../../logging/log';

import Helpers from '../Helpers';

export type SetCredentialsOptions = {
  aci: AciString;
  pni: PniString;
  number: string;
  deviceId: number;
  deviceName?: string;
  password: string;
};

export class User {
  constructor(private readonly storage: StorageInterface) {}

  public async setAciAndDeviceId(
    aci: AciString,
    deviceId: number
  ): Promise<void> {
    await this.storage.put('uuid_id', `${aci}.${deviceId}`);

    log.info('storage.user: aci and device id changed');
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
    if (numberId === undefined) {
      return undefined;
    }
    return Helpers.unencodeNumber(numberId)[0];
  }

  public getPni(): PniString | undefined {
    const pni = this.storage.get('pni');
    if (pni === undefined || !isPniString(pni)) {
      return undefined;
    }
    return pni;
  }

  public getAci(): AciString | undefined {
    const uuidId = this.storage.get('uuid_id');
    if (!uuidId) {
      return undefined;
    }
    const aci = Helpers.unencodeNumber(uuidId.toLowerCase())[0];
    if (!isAciString(aci)) {
      return undefined;
    }
    return aci;
  }

  public getServiceId(
    serviceIdKind: ServiceIdKind
  ): ServiceIdString | undefined {
    if (serviceIdKind === ServiceIdKind.PNI) {
      return this.getPni();
    }

    strictAssert(
      serviceIdKind === ServiceIdKind.ACI,
      `Unsupported uuid kind: ${serviceIdKind}`
    );
    return this.getAci();
  }

  public getCheckedAci(): AciString {
    const aci = this.getAci();
    strictAssert(aci !== undefined, 'Must have our own ACI');
    return aci;
  }

  public getCheckedPni(): PniString {
    const pni = this.getPni();
    strictAssert(pni !== undefined, 'Must have our own PNI');
    return pni;
  }

  public getCheckedServiceId(serviceIdKind: ServiceIdKind): ServiceIdString {
    const uuid = this.getServiceId(serviceIdKind);
    strictAssert(uuid !== undefined, 'Must have our own uuid');
    return uuid;
  }

  public async setPni(pni: PniString): Promise<void> {
    await this.storage.put('pni', pni);
  }

  public getOurServiceIdKind(serviceId: ServiceIdString): ServiceIdKind {
    const ourAci = this.getAci();
    if (ourAci === serviceId) {
      return ServiceIdKind.ACI;
    }

    const pni = this.getPni();
    if (pni === serviceId) {
      return ServiceIdKind.PNI;
    }

    return ServiceIdKind.Unknown;
  }

  public isOurServiceId(serviceId: ServiceIdString): boolean {
    return this.getOurServiceIdKind(serviceId) !== ServiceIdKind.Unknown;
  }

  public getDeviceId(): number | undefined {
    const value =
      this.#_getDeviceIdFromUuid() || this.#_getDeviceIdFromNumber();
    if (value === undefined) {
      return undefined;
    }
    return parseInt(value, 10);
  }

  public getDeviceName(): string | undefined {
    return this.storage.get('device_name');
  }

  public async setDeviceName(name: string): Promise<void> {
    return this.storage.put('device_name', name);
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
    const { aci, pni, number, deviceId, deviceName, password } = credentials;

    await Promise.all([
      this.storage.put('number_id', `${number}.${deviceId}`),
      this.storage.put('uuid_id', `${aci}.${deviceId}`),
      this.storage.put('password', password),
      this.setPni(pni),
      deviceName ? this.setDeviceName(deviceName) : Promise.resolve(),
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

  #_getDeviceIdFromUuid(): string | undefined {
    const uuid = this.storage.get('uuid_id');
    if (uuid === undefined) {
      return undefined;
    }
    return Helpers.unencodeNumber(uuid)[1];
  }

  #_getDeviceIdFromNumber(): string | undefined {
    const numberId = this.storage.get('number_id');
    if (numberId === undefined) {
      return undefined;
    }
    return Helpers.unencodeNumber(numberId)[1];
  }
}
