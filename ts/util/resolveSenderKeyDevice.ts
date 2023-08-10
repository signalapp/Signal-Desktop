// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DeviceType } from '../textsecure/Types.d';
import type { SenderKeyDeviceType } from '../model-types.d';
import * as log from '../logging/log';

export function resolveSenderKeyDevice({
  identifier,
  ...rest
}: SenderKeyDeviceType): DeviceType | undefined {
  const logId = `resolveSenderKeyDevice(${identifier})`;
  const convo = window.ConversationController.get(identifier);
  if (!convo) {
    log.warn(`${logId}: conversation not found`);
    return undefined;
  }

  const serviceId = convo.getServiceId();
  if (!serviceId) {
    log.warn(
      `${logId}: conversation ${convo.idForLogging()} has no service id`
    );
    return undefined;
  }

  return {
    ...rest,
    serviceId,
  };
}
