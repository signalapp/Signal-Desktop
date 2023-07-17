import { findIndex } from 'lodash';
import { OpenGroupData } from '../../../../data/opengroups';
import { DecodedResponseBodiesV4 } from '../../../onions/onionv4';
import { BatchSogsReponse, OpenGroupBatchRow } from './sogsV3BatchPoll';
import { parseCapabilities } from './sogsV3Capabilities';

/**
 * @param subrequestOptionsLookup list of subrequests used for the batch request (order sensitive)
 * @param batchPollResults The result from the batch request (order sensitive)
 */
export const getCapabilitiesFromBatch = (
  subrequestOptionsLookup: Array<OpenGroupBatchRow>,
  bodies: DecodedResponseBodiesV4
): Array<string> | null => {
  const capabilitiesBatchIndex = findIndex(
    subrequestOptionsLookup,
    (subrequest: OpenGroupBatchRow) => {
      return subrequest.type === 'capabilities';
    }
  );
  const capabilities: Array<string> | null =
    parseCapabilities(bodies?.[capabilitiesBatchIndex]?.body) || null;
  return capabilities;
};

/** using this as explicit way to ensure order  */
export const handleCapabilities = async (
  subrequestOptionsLookup: Array<OpenGroupBatchRow>,
  batchPollResults: BatchSogsReponse,
  serverUrl: string
  // roomId: string
): Promise<null | Array<string>> => {
  if (!batchPollResults.body) {
    return null;
  }
  const capabilities = getCapabilitiesFromBatch(subrequestOptionsLookup, batchPollResults.body);

  if (!capabilities) {
    window?.log?.error(
      'Failed capabilities subrequest - cancelling capabilities response handling'
    );
    return null;
  }

  // get all v2OpenGroup rooms with the matching serverUrl and set the capabilities.
  // TODOLATER: capabilities are shared accross a server, not a room. We should probably move this to the server but we do not a server level currently, just rooms

  const rooms = OpenGroupData.getV2OpenGroupRoomsByServerUrl(serverUrl);

  if (!rooms || !rooms.length) {
    window?.log?.error('handleCapabilities - Found no groups with matching server url');
    return null;
  }

  const updatedRooms = rooms.map(r => ({ ...r, capabilities }));
  await OpenGroupData.saveV2OpenGroupRooms(updatedRooms);

  return capabilities;
};
