import { OpenGroupV2Info } from './ApiUtil';
import _ from 'lodash';

/**
 * An onion request to the open group api returns something like
 * {result: {status_code:number; whatever: somerandomtype}; }
 *
 * This utility function just extract the status code and returns it.
 * If the status code is not found, this function returns undefined;
 */
export const parseStatusCodeFromOnionRequest = (
  onionResult: any
): number | undefined => {
  if (!onionResult) {
    return undefined;
  }
  const statusCode = onionResult?.result?.status_code;
  if (statusCode) {
    return statusCode;
  }
  return undefined;
};

export const parseMemberCount = (onionResult: any): number | undefined => {
  if (!onionResult) {
    return undefined;
  }
  const memberCount = onionResult?.result?.member_count;
  if (memberCount) {
    return memberCount;
  }
  return undefined;
};

export const parseRooms = (
  onionResult: any
): undefined | Array<OpenGroupV2Info> => {
  if (!onionResult) {
    return undefined;
  }
  const rooms = onionResult?.result?.rooms as Array<any>;
  if (!rooms || !rooms.length) {
    window.log.warn('getAllRoomInfos failed invalid infos');
    return [];
  }
  return _.compact(
    rooms.map(room => {
      // check that the room is correctly filled
      const { id, name, image_id: imageId } = room;
      if (!id || !name) {
        window.log.info('getAllRoomInfos: Got invalid room details, skipping');
        return null;
      }

      return { id, name, imageId } as OpenGroupV2Info;
    })
  );
};

export const parseModerators = (
  onionResult: any
): Array<string> | undefined => {
  const moderatorsGot = onionResult?.result?.moderators as
    | Array<string>
    | undefined;
  return moderatorsGot;
};
