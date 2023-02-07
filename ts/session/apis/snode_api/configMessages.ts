// import { isEmpty, sample } from 'lodash';
// import pRetry from 'p-retry';
// import { Snode } from '../../../data/data';
// import { ed25519Str } from '../../onions/onionPath';
// import { SingleDestinationChanges } from '../../utils/job_runners/jobs/ConfigurationSyncJob';
// import { doSnodeBatchRequest } from './batchRequest';
// import { SnodeAPI } from './SNodeAPI';
// import { getSwarmFor } from './snodePool';
// import { StoreOnNodeSubRequest } from './SnodeRequestTypes';

// function prepareRequest(singleDestChange: SingleDestinationChanges): Array<StoreOnNodeSubRequest> {
//   if (isEmpty(singleDestChange) || isEmpty(singleDestChange.messages)) {
//     return [];
//   }

//   return singleDestChange.messages.map(message => {
//     return { method: 'store', params: {} };
//   });
// }

/**
 * Locally deletes message and deletes message on the network (all nodes that contain the message)
 */
// const sendConfigMessages = async (
//     singleDestChange: SingleDestinationChanges
// ): Promise<Array<string> | null> => {
//     if (isEmpty(singleDestChange) || isEmpty(singleDestChange.messages)) {
//         return true;
//     }
//     try {
//       const result = await pRetry(
//         async () => {
//           const swarmToSendTo = await getSwarmFor(singleDestChange.destination);
//           const snodeToMakeRequestTo: Snode | undefined = sample(swarmToSendTo);

//           if (!snodeToMakeRequestTo) {
//             window?.log?.warn('Cannot networkDeleteMessages, without a valid swarm node.');
//             return null;
//           }

//           return pRetry(
//             async () => {
//               const ret = await doSnodeBatchRequest([{method: 'store', params: {}}]);
//               if (!ret) {
//                 throw new Error(
//                   `Empty response got for delete on snode ${ed25519Str(
//                     snodeToMakeRequestTo.pubkey_ed25519
//                   )}`
//                 );
//               }

//                 return results;
//               }
//             },
//             {
//               retries: 3,
//               minTimeout: SnodeAPI.TEST_getMinTimeout(),
//               onFailedAttempt: e => {
//                 window?.log?.warn(
//                   `delete INNER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
//                 );
//               },
//             }
//           );
//         },
//         {
//           retries: 3,
//           minTimeout: SnodeAPI.TEST_getMinTimeout(),
//           onFailedAttempt: e => {
//             window?.log?.warn(
//               `delete OUTER request attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
//             );
//           },
//         }
//       );

//       return maliciousSnodes;
//     } catch (e) {
//       window?.log?.warn('failed to delete message on network:', e);
//       return null;
//     }
//   };
