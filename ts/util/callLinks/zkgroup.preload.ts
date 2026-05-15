// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallLinkRootKey } from '@signalapp/ringrtc';
import { Aci } from '@signalapp/libsignal-client';
import { getCheckedCallLinkAuthCredentialsForToday } from '../../services/groupCredentialFetcher.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import type { CallLinkAuthCredentialPresentation } from '../zkgroup.node.ts';
import * as durations from '../durations/index.std.ts';
import {
  CallLinkAuthCredential,
  CallLinkSecretParams,
  GenericServerPublicParams,
} from '../zkgroup.node.ts';

export async function getCallLinkAuthCredentialPresentation(
  callLinkRootKey: CallLinkRootKey
): Promise<CallLinkAuthCredentialPresentation> {
  const credentials = getCheckedCallLinkAuthCredentialsForToday(
    'getCallLinkAuthCredentialPresentation'
  );
  const todaysCredentials = credentials.today.credential;
  const credential = new CallLinkAuthCredential(
    Buffer.from(todaysCredentials, 'base64')
  );

  const genericServerPublicParamsBase64 = window.getGenericServerPublicParams();
  const genericServerPublicParams = new GenericServerPublicParams(
    Buffer.from(genericServerPublicParamsBase64, 'base64')
  );

  const ourAci = itemStorage.user.getAci();
  if (ourAci == null) {
    throw new Error('Failed to get our ACI');
  }
  const userId = Aci.fromUuid(ourAci);

  // @ts-expect-error needs ringrtc update
  const rootKeyBytes: Uint8Array<ArrayBuffer> = callLinkRootKey.bytes;

  const callLinkSecretParams =
    CallLinkSecretParams.deriveFromRootKey(rootKeyBytes);
  const presentation = credential.present(
    userId,
    credentials.today.redemptionTime / durations.SECOND,
    genericServerPublicParams,
    callLinkSecretParams
  );
  return presentation;
}
