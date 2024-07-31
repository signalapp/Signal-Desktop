import _, { range } from 'lodash';
import { isTestNet } from '../../../shared/env_vars';
import { getSodiumRenderer } from '../../crypto';
import {
  fromHexToArray,
  fromUInt8ArrayToBase64,
  stringToUint8Array,
  toHex,
} from '../../utils/String';
import { NotFoundError } from '../../utils/errors';
import { OnsResolveSubRequest } from './SnodeRequestTypes';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { getRandomSnode } from './snodePool';

// ONS name can have [a-zA-Z0-9_-] except that - is not allowed as start or end
// do not define a regex but rather create it on the fly to avoid https://stackoverflow.com/questions/3891641/regex-test-only-works-every-other-time
const onsNameRegex = '^\\w([\\w-]*[\\w])?$';

function buildOnsResolveRequests(base64EncodedNameHash: string): Array<OnsResolveSubRequest> {
  const request: OnsResolveSubRequest = {
    method: 'oxend_request',
    params: {
      endpoint: 'ons_resolve',
      params: { type: 0, name_hash: base64EncodedNameHash },
    },
  };
  return [request];
}

async function getSessionIDForOnsName(onsNameCase: string) {
  const validationCount = 3;

  const onsNameLowerCase = onsNameCase.toLowerCase();
  const sodium = await getSodiumRenderer();
  const nameAsData = stringToUint8Array(onsNameLowerCase);
  const nameHash = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, nameAsData);
  const base64EncodedNameHash = fromUInt8ArrayToBase64(nameHash);

  if (isTestNet()) {
    window.log.info('OnsResolve response are not registered to anything on testnet');
  }

  const onsResolveRequests = buildOnsResolveRequests(base64EncodedNameHash);

  // we do this request with validationCount snodes
  const promises = range(0, validationCount).map(async () => {
    const targetNode = await getRandomSnode();

    const results = await doSnodeBatchRequest(onsResolveRequests, targetNode, 4000, null);
    const firstResult = results[0];
    if (!firstResult || firstResult.code !== 200 || !firstResult.body) {
      throw new Error('ONSresolve:Failed to resolve ONS');
    }
    const parsedBody = firstResult.body;
    GetNetworkTime.handleTimestampOffsetFromNetwork('ons_resolve', parsedBody.t);

    const intermediate = parsedBody?.result;

    if (!intermediate || !intermediate?.encrypted_value) {
      throw new NotFoundError('ONSresolve: no encrypted_value');
    }
    const hexEncodedCipherText = intermediate?.encrypted_value;

    const ciphertext = fromHexToArray(hexEncodedCipherText);
    let key: Uint8Array;
    // we dropped support for argon2 based ons

    const hexEncodedNonce = intermediate.nonce as string;
    if (!hexEncodedNonce) {
      throw new Error('ONSresolve: No hexEncodedNonce');
    }
    const nonce = fromHexToArray(hexEncodedNonce);

    try {
      key = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, nameAsData, nameHash);
      if (!key) {
        throw new Error('ONSresolve: Hashing failed');
      }
    } catch (e) {
      window?.log?.warn('ONSresolve: hashing failed', e);
      throw new Error('ONSresolve: Hashing failed');
    }

    const sessionIDAsData = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      key
    );

    if (!sessionIDAsData) {
      throw new Error('ONSresolve: Decryption failed');
    }

    return toHex(sessionIDAsData);
  });

  try {
    // if one promise throws, we end un the catch case
    const allResolvedSessionIds = await Promise.all(promises);
    if (allResolvedSessionIds?.length !== validationCount) {
      throw new Error('ONSresolve: Validation failed');
    }

    // assert all the returned account ids are the same
    if (_.uniq(allResolvedSessionIds).length !== 1) {
      throw new Error('ONSresolve: Validation failed');
    }
    return allResolvedSessionIds[0];
  } catch (e) {
    window.log.warn('ONSresolve: error', e);
    throw e;
  }
}

export const ONSResolve = { onsNameRegex, getSessionIDForOnsName };
