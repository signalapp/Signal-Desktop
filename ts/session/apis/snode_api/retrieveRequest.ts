import { Snode } from '../../../data/data';
import { updateIsOnline } from '../../../state/ducks/onion';
import { getSodiumRenderer } from '../../crypto';
import { StringUtils, UserUtils } from '../../utils';
import { fromHexToArray, fromUInt8ArrayToBase64 } from '../../utils/String';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { SnodeNamespaces } from './namespaces';
import {
  RetrieveLegacyClosedGroupSubRequestType,
  RetrieveSubRequestType,
} from './SnodeRequestTypes';

async function getRetrieveSignatureParams(params: {
  pubkey: string;
  namespace: number;
  ourPubkey: string;
}): Promise<{
  timestamp: number;
  signature: string;
  pubkey_ed25519: string;
  namespace: number;
}> {
  const ourEd25519Key = await UserUtils.getUserED25519KeyPair();

  if (!ourEd25519Key) {
    window.log.warn('getRetrieveSignatureParams: User has no getUserED25519KeyPair()');
    throw new Error('getRetrieveSignatureParams: User has no getUserED25519KeyPair()');
  }
  const namespace = params.namespace || 0;
  const edKeyPrivBytes = fromHexToArray(ourEd25519Key?.privKey);

  const signatureTimestamp = GetNetworkTime.getNowWithNetworkOffset();

  const verificationData =
    namespace === 0
      ? StringUtils.encode(`retrieve${signatureTimestamp}`, 'utf8')
      : StringUtils.encode(`retrieve${namespace}${signatureTimestamp}`, 'utf8');

  const message = new Uint8Array(verificationData);

  const sodium = await getSodiumRenderer();
  try {
    const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
    const signatureBase64 = fromUInt8ArrayToBase64(signature);

    return {
      timestamp: signatureTimestamp,
      signature: signatureBase64,
      pubkey_ed25519: ourEd25519Key.pubKey,
      namespace,
    };
  } catch (e) {
    window.log.warn('getSignatureParams failed with: ', e.message);
    throw e;
  }
}

async function buildRetrieveRequest(
  lastHashes: Array<string>,
  pubkey: string,
  namespaces: Array<SnodeNamespaces>,
  ourPubkey: string
): Promise<Array<RetrieveSubRequestType>> {
  const retrieveRequestsParams = await Promise.all(
    namespaces.map(async (namespace, index) => {
      const retrieveParam = {
        pubkey,
        last_hash: lastHashes.at(index) || '',
        namespace,
        timestamp: GetNetworkTime.getNowWithNetworkOffset(),
      };

      if (namespace === SnodeNamespaces.ClosedGroupMessages) {
        if (pubkey === ourPubkey || !pubkey.startsWith('05')) {
          throw new Error(
            'namespace -10 can only be used to retrieve messages from a legacy closed group'
          );
        }
        const retrieveLegacyClosedGroup = {
          ...retrieveParam,
          namespace: namespace as -10,
        };
        const retrieveParamsLegacy: RetrieveLegacyClosedGroupSubRequestType = {
          method: 'retrieve',
          params: { ...retrieveLegacyClosedGroup },
        };

        return retrieveParamsLegacy;
      }

      // all legacy closed group retrieves are unauthenticated and run above.
      // if we get here, this can only be a retrieve for our own swarm, which needs to be authenticated
      if (
        namespace !== SnodeNamespaces.UserMessages &&
        namespace !== SnodeNamespaces.UserContacts &&
        namespace !== SnodeNamespaces.UserProfile
      ) {
        throw new Error('not a legacy closed group. namespace can only be 0');
      }
      if (pubkey !== ourPubkey) {
        throw new Error('not a legacy closed group. pubkey can only be our number');
      }
      const signatureArgs = { ...retrieveParam, ourPubkey };
      const signatureBuilt = await getRetrieveSignatureParams(signatureArgs);
      const retrieve: RetrieveSubRequestType = {
        method: 'retrieve',
        params: { ...retrieveParam, ...signatureBuilt },
      };
      return retrieve;
    })
  );

  return retrieveRequestsParams;
}

/** */
async function retrieveNextMessages(
  targetNode: Snode,
  lastHashes: Array<string>,
  associatedWith: string,
  namespaces: Array<SnodeNamespaces>,
  ourPubkey: string
): Promise<Array<{ code: number; messages: Array<Record<string, any>> }>> {
  if (namespaces.length !== lastHashes.length) {
    throw new Error('namespaces and lasthashes does not match');
  }

  const retrieveRequestsParams = await buildRetrieveRequest(
    lastHashes,
    associatedWith,
    namespaces,
    ourPubkey
  );
  // let exceptions bubble up
  // no retry for this one as this a call we do every few seconds while polling for messages

  console.warn('retrieveRequestsParams', retrieveRequestsParams);
  const results = await doSnodeBatchRequest(retrieveRequestsParams, targetNode, 4000);

  if (!results || !results.length) {
    window?.log?.warn(
      `_retrieveNextMessages - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
    throw new Error(
      `_retrieveNextMessages - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
  }

  if (results.length !== namespaces.length) {
    throw new Error(
      `We asked for updates about ${namespaces.length} messages but got results of length ${results.length}`
    );
  }

  if (namespaces.length > 1) {
    throw new Error('multiple namespace polling todo');
  }
  const firstResult = results[0];

  if (firstResult.code !== 200) {
    window?.log?.warn(`retrieveNextMessages result is not 200 but ${firstResult.code}`);
    throw new Error(
      `_retrieveNextMessages - retrieve result is not 200 with ${targetNode.ip}:${targetNode.port} but ${firstResult.code}`
    );
  }

  console.warn('what should we do if we dont get a 200 on any of those fetches?');

  try {
    // we rely on the code of the
    const bodyFirstResult = firstResult.body;
    if (!window.inboxStore?.getState().onionPaths.isOnline) {
      window.inboxStore?.dispatch(updateIsOnline(true));
    }

    GetNetworkTime.handleTimestampOffsetFromNetwork('retrieve', bodyFirstResult.t);
    // merge results with their corresponding namespaces

    return results.map((result, index) => ({
      code: result.code,
      messages: result.body as Array<any>,
      namespace: namespaces[index],
    }));
  } catch (e) {
    window?.log?.warn('exception while parsing json of nextMessage:', e);
    if (!window.inboxStore?.getState().onionPaths.isOnline) {
      window.inboxStore?.dispatch(updateIsOnline(true));
    }
    throw new Error(
      `_retrieveNextMessages - exception while parsing json of nextMessage ${targetNode.ip}:${targetNode.port}: ${e?.message}`
    );
  }
}

export const SnodeAPIRetrieve = { retrieveNextMessages };
