// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { timingSafeEqual } from 'node:crypto';
import createDebug from 'debug';
import {
  Aci,
  Pni,
  ProtocolAddress,
  PublicKey,
} from '@signalapp/libsignal-client';
import {
  BackupLevel,
  ProfileKeyCommitment,
} from '@signalapp/libsignal-client/zkgroup';

import {
  AciString,
  DeviceId,
  KyberPreKey,
  PniString,
  PreKey,
  RegistrationId,
  ServiceIdKind,
  ServiceIdString,
  SignedPreKey,
} from '../types';

const debug = createDebug('mock:device');

export type DeviceOptions = Readonly<{
  aci: AciString;
  pni: PniString | undefined;
  number: string | undefined;
  deviceId: DeviceId;
  registrationId: RegistrationId;
  pniRegistrationId: RegistrationId | undefined;
  isProvisioned: boolean;
  authCredentialSalt: Buffer<ArrayBuffer>;
}>;

export type ChangeNumberOptions = Readonly<{
  number: string;
  pni: PniString;
  pniRegistrationId: RegistrationId;
}>;

export type DeviceKeys = Readonly<{
  identityKey: PublicKey;
  preKeys?: ReadonlyArray<PreKey>;
  kyberPreKeys?: ReadonlyArray<KyberPreKey>;
  lastResortKey?: KyberPreKey;
  signedPreKey?: SignedPreKey;

  preKeyIterator?: AsyncIterator<PreKey, undefined>;
  kyberPreKeyIterator?: AsyncIterator<KyberPreKey, undefined>;
}>;

export type SingleUseKey = Readonly<{
  identityKey: PublicKey;

  signedPreKey: SignedPreKey;
  preKey: PreKey | undefined;
  pqPreKey: KyberPreKey;
}>;

type InternalDeviceKeys = Readonly<{
  identityKey: PublicKey;
  signedPreKey: SignedPreKey;
  lastResortKey: KyberPreKey;
  preKeys: Array<PreKey>;
  kyberPreKeys: Array<KyberPreKey>;
  preKeyIterator?: AsyncIterator<PreKey, undefined>;
  kyberPreKeyIterator?: AsyncIterator<KyberPreKey, undefined>;
}>;

// Technically, it is infinite.
const PRE_KEY_ITERATOR_COUNT = 100;

export class Device {
  public readonly aci: AciString;
  public readonly deviceId: DeviceId;
  public readonly address: ProtocolAddress;

  // If `true` - the device was provisioned and should receive messages over
  // the websocket.
  public readonly isProvisioned: boolean;

  public capabilities: {
    deleteSync: boolean;
    versionedExpirationTimer: boolean;
    ssre2: boolean;
    usernameChangeSyncMessage: boolean;
  };

  public backupLevel = BackupLevel.Paid;
  public accessKey?: Buffer<ArrayBuffer>;
  public profileKeyCommitment?: ProfileKeyCommitment;
  public profileName?: Buffer<ArrayBuffer>;
  public readonly authCredentialSalt: Buffer<ArrayBuffer>;

  private keys = new Map<ServiceIdKind, InternalDeviceKeys>();

  private privPni: PniString | undefined;
  private privNumber: string | undefined;
  private privPniAddress: ProtocolAddress | undefined;
  private readonly registrationId: RegistrationId;
  private pniRegistrationId: RegistrationId | undefined;

  constructor(options: DeviceOptions) {
    this.aci = options.aci;
    this.deviceId = options.deviceId;
    this.registrationId = options.registrationId;

    this.privPni = options.pni;
    this.privNumber = options.number;
    this.pniRegistrationId = options.pniRegistrationId;

    this.isProvisioned = options.isProvisioned;
    this.authCredentialSalt = options.authCredentialSalt;

    this.address = ProtocolAddress.new(this.aci, this.deviceId);
    this.privPniAddress =
      this.pni == null
        ? undefined
        : ProtocolAddress.new(this.pni, this.deviceId);
    this.capabilities = {
      deleteSync: true,
      versionedExpirationTimer: true,
      ssre2: true,
      usernameChangeSyncMessage: true,
    };
  }

  public get debugId(): string {
    return `${this.aci}.${this.deviceId}`;
  }

  public getCheckedRegistrationId(serviceIdKind: ServiceIdKind): number {
    switch (serviceIdKind) {
      case ServiceIdKind.ACI:
        return this.registrationId;
      case ServiceIdKind.PNI:
        if (this.pniRegistrationId == null) {
          throw new Error('No PNI registration id');
        }
        return this.pniRegistrationId;
    }
  }

  public get aciBinary(): Uint8Array<ArrayBuffer> {
    return Aci.parseFromServiceIdString(this.aci).getServiceIdBinary();
  }

  public get pni(): PniString | undefined {
    return this.privPni;
  }

  public get checkedPni(): PniString {
    if (this.privPni == null) {
      throw new Error(`No PNI for ${this.debugId}`);
    }
    return this.privPni;
  }

  public get pniBinary(): Uint8Array<ArrayBuffer> | undefined {
    if (this.pni == null) {
      return undefined;
    }
    return Pni.parseFromServiceIdString(this.pni).getServiceIdBinary();
  }

  public get checkedPniBinary(): Uint8Array<ArrayBuffer> {
    const res = this.pniBinary;

    if (res == null) {
      throw new Error(`No PNI for ${this.debugId}`);
    }
    return res;
  }

  public get aciRawUuid(): Uint8Array<ArrayBuffer> {
    return Aci.parseFromServiceIdString(this.aci).getRawUuidBytes();
  }

  public get pniRawUuid(): Uint8Array<ArrayBuffer> | undefined {
    if (this.pni == null) {
      return undefined;
    }
    return Pni.parseFromServiceIdString(this.pni).getRawUuidBytes();
  }

  public get checkedPniRawUuid(): Uint8Array<ArrayBuffer> {
    const res = this.pniRawUuid;

    if (res == null) {
      throw new Error(`No PNI for ${this.debugId}`);
    }
    return res;
  }

  public get number(): string | undefined {
    return this.privNumber;
  }

  public get checkedNumber(): string {
    const res = this.number;

    if (res == null) {
      throw new Error(`No E164 for ${this.debugId}`);
    }
    return res;
  }

  public get pniAddress(): ProtocolAddress | undefined {
    return this.privPniAddress;
  }

  public get checkedPniAddress(): ProtocolAddress {
    const res = this.pniAddress;

    if (res == null) {
      throw new Error(`No PNI for ${this.debugId}`);
    }
    return res;
  }

  public async changeNumber({
    number,
    pni,
    pniRegistrationId,
  }: ChangeNumberOptions): Promise<void> {
    this.privNumber = number;
    this.privPni = pni;
    this.pniRegistrationId = pniRegistrationId;
    this.privPniAddress = ProtocolAddress.new(pni, this.deviceId);
  }

  public async setKeys(
    serviceIdKind: ServiceIdKind,
    keys: DeviceKeys,
  ): Promise<void> {
    debug('setting %s keys for %s', serviceIdKind, this.debugId);
    const existingKeys = this.keys.get(serviceIdKind);
    const {
      signedPreKey = existingKeys?.signedPreKey,
      lastResortKey = existingKeys?.lastResortKey,
    } = keys;

    if (!signedPreKey) {
      throw new Error('setKeys: Missing signedPreKey');
    }
    if (!lastResortKey) {
      throw new Error('setKeys: Missing lastResortKey');
    }

    this.keys.set(serviceIdKind, {
      identityKey: keys.identityKey,

      signedPreKey,
      preKeys: keys.preKeys?.slice() ?? [],
      kyberPreKeys: keys.kyberPreKeys?.slice() ?? [],
      lastResortKey,

      preKeyIterator: keys.preKeyIterator,
      kyberPreKeyIterator: keys.kyberPreKeyIterator,
    });
  }

  public async getIdentityKey(
    serviceIdKind = ServiceIdKind.ACI,
  ): Promise<PublicKey> {
    const keys = this.keys.get(serviceIdKind);
    if (!keys) {
      throw new Error('No keys available for device');
    }
    return keys.identityKey;
  }

  public async popSingleUseKey(
    serviceIdKind = ServiceIdKind.ACI,
  ): Promise<SingleUseKey> {
    const keys = this.keys.get(serviceIdKind);
    if (!keys) {
      throw new Error('No keys available for device');
    }

    debug('popping single use key for %s', this.debugId);

    let preKey: PreKey | undefined;
    if (keys.preKeyIterator) {
      const { value } = await keys.preKeyIterator.next();
      preKey = value;
    }
    preKey ??= keys.preKeys.shift();

    let pqPreKey: KyberPreKey | undefined;
    if (keys.kyberPreKeyIterator) {
      const { value } = await keys.kyberPreKeyIterator.next();
      pqPreKey = value;
    }
    pqPreKey ??= keys.kyberPreKeys.shift();
    pqPreKey ??= keys.lastResortKey;

    if (!pqPreKey) {
      throw new Error(
        'popSingleUseKey: Missing pqPreKey; checked iterator/array/lastResort',
      );
    }

    return {
      identityKey: keys.identityKey,
      signedPreKey: keys.signedPreKey,
      preKey,
      pqPreKey,
    };
  }

  public async getPreKeyCount(
    serviceIdKind = ServiceIdKind.ACI,
  ): Promise<number> {
    const keys = this.keys.get(serviceIdKind);
    if (!keys) {
      return 0;
    }
    if (keys.preKeyIterator) {
      return PRE_KEY_ITERATOR_COUNT;
    }
    return keys.preKeys.length;
  }

  public async getKyberPreKeyCount(
    serviceIdKind = ServiceIdKind.ACI,
  ): Promise<number> {
    const keys = this.keys.get(serviceIdKind);
    if (!keys) {
      return 0;
    }
    if (keys.kyberPreKeyIterator) {
      return PRE_KEY_ITERATOR_COUNT;
    }
    return keys.kyberPreKeys.length;
  }

  public getServiceIdByKind(
    serviceIdKind: ServiceIdKind,
  ): ServiceIdString | undefined {
    switch (serviceIdKind) {
      case ServiceIdKind.ACI:
        return this.aci;
      case ServiceIdKind.PNI:
        return this.pni;
    }
  }

  public getServiceIdBinaryByKind(
    serviceIdKind: ServiceIdKind,
  ): Uint8Array<ArrayBuffer> | undefined {
    switch (serviceIdKind) {
      case ServiceIdKind.ACI:
        return this.aciBinary;
      case ServiceIdKind.PNI:
        return this.pniBinary;
    }
  }

  public getServiceIdKind(serviceId: ServiceIdString): ServiceIdKind {
    if (serviceId === this.aci) {
      return ServiceIdKind.ACI;
    }
    if (serviceId === this.pni) {
      return ServiceIdKind.PNI;
    }
    throw new Error(`Unknown serviceId: ${serviceId}`);
  }

  public getServiceIdBinaryKind(
    serviceIdBinary: Uint8Array<ArrayBuffer>,
  ): ServiceIdKind {
    if (timingSafeEqual(serviceIdBinary, this.aciBinary)) {
      return ServiceIdKind.ACI;
    }
    const { pniBinary } = this;
    if (pniBinary != null && timingSafeEqual(serviceIdBinary, pniBinary)) {
      return ServiceIdKind.PNI;
    }
    throw new Error('Unknown serviceId');
  }

  public getAddressByKind(
    serviceIdKind: ServiceIdKind,
  ): ProtocolAddress | undefined {
    switch (serviceIdKind) {
      case ServiceIdKind.ACI:
        return this.address;
      case ServiceIdKind.PNI:
        return this.pniAddress;
    }
  }
}
