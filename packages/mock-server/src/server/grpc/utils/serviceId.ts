// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ServiceId, Aci, Pni } from '@signalapp/libsignal-client';
import { ServiceIdKind, ServiceIdString } from '../../../types';
import { org } from '../../../../protos/compiled';

export function toServiceIdentifier(
  string: ServiceIdString,
): org.signal.chat.common.ServiceIdentifier.Params {
  const object = ServiceId.parseFromServiceIdString(string);
  if (object instanceof Pni) {
    return {
      identityType: org.signal.chat.common.IdentityType.IDENTITY_TYPE_PNI,
      uuid: object.getRawUuidBytes(),
    };
  }

  if (object instanceof Aci) {
    return {
      identityType: org.signal.chat.common.IdentityType.IDENTITY_TYPE_ACI,
      uuid: object.getRawUuidBytes(),
    };
  }

  throw new Error(`Invalid service id: ${string}`);
}

export function toServiceIdKind(
  identityType: org.signal.chat.common.IdentityType,
): ServiceIdKind {
  const { IdentityType } = org.signal.chat.common;
  if (identityType === IdentityType.IDENTITY_TYPE_ACI) {
    return ServiceIdKind.ACI;
  }
  if (identityType === IdentityType.IDENTITY_TYPE_PNI) {
    return ServiceIdKind.PNI;
  }
  throw new Error(`Unsupported identity type: ${identityType}`);
}

export function fromServiceIdentifier(
  identifier: org.signal.chat.common.ServiceIdentifier | null,
): ServiceIdString {
  if (identifier == null) {
    throw new Error('Missing service identifier');
  }

  const { IdentityType } = org.signal.chat.common;

  let serviceId: ServiceId;
  if (identifier.identityType === IdentityType.IDENTITY_TYPE_ACI) {
    serviceId = Aci.fromUuidBytes(identifier.uuid);
  } else if (identifier.identityType === IdentityType.IDENTITY_TYPE_PNI) {
    serviceId = Pni.fromUuidBytes(identifier.uuid);
  } else {
    throw new Error(`Unsupported identity type: ${identifier.identityType}`);
  }

  return serviceId.getServiceIdString() as ServiceIdString;
}
