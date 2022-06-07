// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JsonRpcProvider } from '@ethersproject/providers/lib/json-rpc-provider';
import { providers as etherProviders } from 'ethers';
import * as log from '../logging/log';

export function canTranslateNameToPhoneNumber(name: string): boolean {
  if (getEtherProvider()) {
    return name.endsWith('.eth');
  }

  return false;
}

export async function translateNameToPhoneNumber(
  name: string
): Promise<string | undefined> {
  const etherProvider = getEtherProvider();
  if (!etherProvider) {
    log.error(
      'translateNameToPhoneNumber: No ether provider available for translation'
    );
    return undefined;
  }

  const resolver = await etherProvider.getResolver(name);
  if (!resolver) {
    log.error(
      'translateNameToPhoneNumber: Failed to get an ether resolver for',
      name
    );
    return undefined;
  }

  const ethAddr = await resolver.getAddress();
  const phoneNumber = await resolver.getText('phone');
  phoneNumber?.trim();
  if (!phoneNumber) {
    log.warn(
      'translateNameToPhoneNumber: No phone record found for',
      name,
      `(Ether address: ${ethAddr})`
    );
    return undefined;
  }

  log.info(
    'translateNameToPhoneNumber: Found',
    name,
    'as',
    ethAddr,
    'and',
    phoneNumber
  );
  return phoneNumber;
}

let haveChecked = false;
let etherProvider: JsonRpcProvider | undefined;

function getEtherProvider(): JsonRpcProvider | undefined {
  if (!haveChecked) {
    const url = window.Events.getEtherProviderUrl();
    if (url) {
      etherProvider = new etherProviders.JsonRpcProvider(url);
      if (!etherProvider) {
        log.error('getEtherProvider: Failed to get a new provider using', url);
      }
    }

    haveChecked = true;
  }

  return etherProvider;
}
