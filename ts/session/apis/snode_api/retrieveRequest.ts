import { Snode } from '../../../data/data';
import { updateIsOnline } from '../../../state/ducks/onion';
import { doSnodeBatchRequest } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { SnodeNamespaces } from './namespaces';

import {
  RetrieveLegacyClosedGroupSubRequestType,
  RetrieveSubRequestType,
} from './SnodeRequestTypes';
import { SnodeSignature } from './snodeSignatures';
import { RetrieveMessagesResultsBatched, RetrieveMessagesResultsContent } from './types';

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

      if (namespace === SnodeNamespaces.ClosedGroupMessage) {
        if (pubkey === ourPubkey || !pubkey.startsWith('05')) {
          throw new Error(
            'namespace -10 can only be used to retrieve messages from a legacy closed group (prefix 05)'
          );
        }
        const retrieveLegacyClosedGroup = {
          ...retrieveParam,
          namespace,
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
        throw new Error('not a legacy closed group. pubkey can only be ours');
      }
      const signatureArgs = { ...retrieveParam, method: 'retrieve' as 'retrieve', ourPubkey };
      const signatureBuilt = await SnodeSignature.getSnodeSignatureParams(signatureArgs);
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
): Promise<RetrieveMessagesResultsBatched> {
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

  const firstResult = results[0];

  // TODO we should probably check for status code of all the results (when polling for a few namespaces at a time)

  if (firstResult.code !== 200) {
    window?.log?.warn(`retrieveNextMessages result is not 200 but ${firstResult.code}`);
    throw new Error(
      `_retrieveNextMessages - retrieve result is not 200 with ${targetNode.ip}:${targetNode.port} but ${firstResult.code}`
    );
  }

  try {
    // we rely on the code of the first one to check for online status
    const bodyFirstResult = firstResult.body;
    if (!window.inboxStore?.getState().onionPaths.isOnline) {
      window.inboxStore?.dispatch(updateIsOnline(true));
    }

    GetNetworkTime.handleTimestampOffsetFromNetwork('retrieve', bodyFirstResult.t);

    // merge results with their corresponding namespaces
    return results.map((result, index) => ({
      code: result.code,
      messages: result.body as RetrieveMessagesResultsContent,
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
