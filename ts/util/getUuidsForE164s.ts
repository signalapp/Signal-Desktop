// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CDSResponseType } from '../textsecure/cds/Types.d';
import type { WebAPIType } from '../textsecure/WebAPI';
import type { UUIDStringType } from '../types/UUID';
import * as log from '../logging/log';
import { isEnabled } from '../RemoteConfig';
import { isDirectConversation, isMe } from './whatTypeOfConversation';

export async function getUuidsForE164s(
  server: Pick<WebAPIType, 'cdsLookup'>,
  e164s: ReadonlyArray<string>
): Promise<CDSResponseType> {
  // Note: these have no relationship to supplied e164s. We just provide
  // all available information to the server so that it could return as many
  // ACI+PNI+E164 matches as possible.
  const acis = new Array<UUIDStringType>();
  const accessKeys = new Array<string>();

  for (const convo of window.ConversationController.getAll()) {
    if (!isDirectConversation(convo.attributes) || isMe(convo.attributes)) {
      continue;
    }

    const aci = convo.getUuid();
    if (!aci) {
      continue;
    }

    convo.deriveAccessKeyIfNeeded();
    const accessKey = convo.get('accessKey');
    if (!accessKey) {
      continue;
    }

    acis.push(aci.toString());
    accessKeys.push(accessKey);
  }

  const returnAcisWithoutUaks =
    !isEnabled('cds.disableCompatibilityMode') &&
    isEnabled('desktop.cdsi.returnAcisWithoutUaks');

  log.info(
    `getUuidsForE164s(${e164s}): acis=${acis.length} ` +
      `accessKeys=${accessKeys.length}`
  );
  return server.cdsLookup({
    e164s,
    acis,
    accessKeys,
    returnAcisWithoutUaks,
  });
}
