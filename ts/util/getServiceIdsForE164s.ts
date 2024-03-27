// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CDSResponseType } from '../textsecure/cds/Types.d';
import type { WebAPIType } from '../textsecure/WebAPI';
import type { AciString } from '../types/ServiceId';
import * as log from '../logging/log';
import { isDirectConversation, isMe } from './whatTypeOfConversation';

export async function getServiceIdsForE164s(
  server: Pick<WebAPIType, 'cdsLookup'>,
  e164s: ReadonlyArray<string>
): Promise<CDSResponseType> {
  // Note: these have no relationship to supplied e164s. We just provide
  // all available information to the server so that it could return as many
  // ACI+PNI+E164 matches as possible.
  const acisAndAccessKeys = new Array<{ aci: AciString; accessKey: string }>();

  for (const convo of window.ConversationController.getAll()) {
    if (!isDirectConversation(convo.attributes) || isMe(convo.attributes)) {
      continue;
    }

    const aci = convo.getAci();
    if (!aci) {
      continue;
    }

    convo.deriveAccessKeyIfNeeded();
    const accessKey = convo.get('accessKey');
    if (!accessKey) {
      continue;
    }

    acisAndAccessKeys.push({ aci, accessKey });
  }

  log.info(
    `getServiceIdsForE164s(${e164s}): acis=${acisAndAccessKeys.length} ` +
      `accessKeys=${acisAndAccessKeys.length}`
  );
  return server.cdsLookup({
    e164s,
    acisAndAccessKeys,
    returnAcisWithoutUaks: false,
    useLibsignal: window.Signal.RemoteConfig.isEnabled(
      'desktop.cdsiViaLibsignal'
    ),
  });
}
