// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Aci, Pni, ServiceId } from '@signalapp/libsignal-client';
import type { AciString, PniString, ServiceIdString } from '../types/ServiceId';

export function toServiceIdObject(serviceId: ServiceIdString): ServiceId {
  return ServiceId.parseFromServiceIdString(serviceId);
}

export function toAciObject(aci: AciString): Aci {
  return Aci.parseFromServiceIdString(aci);
}

export function toPniObject(pni: PniString): Pni {
  return Pni.parseFromServiceIdString(pni);
}
