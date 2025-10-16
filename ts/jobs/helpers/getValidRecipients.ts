// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNotNil } from '../../util/isNotNil.std.js';

import type { LoggerType } from '../../types/Logging.std.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';

export function getValidRecipients(
  recipients: Array<string>,
  options: {
    logId: string;
    log: LoggerType;
  }
): Array<ServiceIdString> {
  const { log, logId } = options;

  return recipients
    .map(id => {
      const recipient = window.ConversationController.get(id);
      if (!recipient) {
        return undefined;
      }
      if (recipient.isUnregistered()) {
        log.warn(
          `${logId}: dropping unregistered recipient ${recipient.idForLogging()}`
        );
        return undefined;
      }
      if (recipient.isBlocked()) {
        log.warn(
          `${logId}: dropping blocked recipient ${recipient.idForLogging()}`
        );
        return undefined;
      }

      return recipient.getSendTarget();
    })
    .filter(isNotNil);
}
