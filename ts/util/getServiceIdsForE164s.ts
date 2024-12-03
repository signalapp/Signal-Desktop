// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CDSResponseType } from '../textsecure/cds/Types.d';
import type { WebAPIType } from '../textsecure/WebAPI';
import type { AciString } from '../types/ServiceId';
import * as log from '../logging/log';
import { isDirectConversation, isMe } from './whatTypeOfConversation';
import { parseNumber } from './libphonenumberUtil';

type PhoneNumberTransformation = {
  oldPattern: RegExp;
  newPattern: RegExp;
  oldToNew: (e164: string) => string;
  newToOld: (e164: string) => string;
};

const PHONE_TRANSFORMATIONS: Record<string, PhoneNumberTransformation> = {
  '229': {
    // Benin
    oldPattern: /^\+229\d{8}$/,
    newPattern: /^\+22901\d{8}$/,
    oldToNew: (e164: string) => e164.replace(/^\+229(\d{8})$/, '+22901$1'),
    newToOld: (e164: string) => e164.replace(/^\+22901(\d{8})$/, '+229$1'),
  },
  '52': {
    // Mexico
    oldPattern: /^\+521\d{10}$/,
    newPattern: /^\+52\d{10}$/,
    oldToNew: (e164: string) => e164.replace(/^\+521(\d{10})$/, '+52$1'),
    newToOld: (e164: string) => e164.replace(/^\+52(\d{10})$/, '+521$1'),
  },
  '54': {
    // Argentina
    oldPattern: /^\+54\d{10}$/,
    newPattern: /^\+549\d{10}$/,
    oldToNew: (e164: string) => e164.replace(/^\+54(\d{10})$/, '+549$1'),
    newToOld: (e164: string) => e164.replace(/^\+549(\d{10})$/, '+54$1'),
  },
};

type ReturnType = CDSResponseType & {
  // Maps from provided E164 phone numbers to their alternate representations
  // found in CDSI. If a E164 appears as a key in this map, you should use the
  // corresponding E164 value for any subsequent operations, as that's
  // the format stored in CDSI's database.
  transformedE164s: Map<string, string>;
};

export async function getServiceIdsForE164s(
  server: Pick<WebAPIType, 'cdsLookup'>,
  e164s: ReadonlyArray<string>
): Promise<ReturnType> {
  const expandedE164s = new Set(e164s);

  const transformationMap = new Map<string, string>();

  for (const e164 of e164s) {
    const parsedNumber = parseNumber(e164);

    if (parsedNumber.isValidNumber && parsedNumber.countryCode) {
      const transform = PHONE_TRANSFORMATIONS[parsedNumber.countryCode];
      if (transform) {
        if (transform.oldPattern.test(e164)) {
          const newFormat = transform.oldToNew(e164);
          expandedE164s.add(newFormat);
          transformationMap.set(e164, newFormat);
        } else if (transform.newPattern.test(e164)) {
          const oldFormat = transform.newToOld(e164);
          expandedE164s.add(oldFormat);
          transformationMap.set(e164, oldFormat);
        }
      }
    }
  }
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

  const expandedE164sArray = Array.from(expandedE164s);

  log.info(
    `getServiceIdsForE164s(${expandedE164sArray}): acis=${acisAndAccessKeys.length} ` +
      `accessKeys=${acisAndAccessKeys.length}`
  );
  const response = await server.cdsLookup({
    e164s: expandedE164sArray,
    acisAndAccessKeys,
    returnAcisWithoutUaks: false,
    useLibsignal: window.Signal.RemoteConfig.isEnabled(
      'desktop.cdsiViaLibsignal'
    ),
  });

  const e164sWithVariantsInCdsi = new Map(
    Array.from(transformationMap).filter(([providedE164, alternateE164]) => {
      if (
        response.entries.has(providedE164) &&
        response.entries.has(alternateE164)
      ) {
        log.warn(`both ${providedE164} and ${alternateE164} are in CDSI`);
        return false;
      }
      if (response.entries.has(alternateE164)) {
        return true;
      }

      return false;
    })
  );

  return {
    ...response,
    transformedE164s: e164sWithVariantsInCdsi,
  };
}
