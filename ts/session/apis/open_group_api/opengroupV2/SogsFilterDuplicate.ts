import _ from 'lodash';
import { Data } from '../../../../data/data';
import { OpenGroupMessageV4 } from './OpenGroupServerPoller';

export const filterDuplicatesFromDbAndIncomingV4 = async (
  newMessages: Array<OpenGroupMessageV4>
): Promise<Array<OpenGroupMessageV4>> => {
  const start = Date.now();

  // open group messages are deduplicated by sender and serverTimestamp only.
  // first make sure that the incoming messages have no duplicates:
  const filtered = _.uniqWith(newMessages, (a, b) => {
    return (
      Boolean(a.session_id) &&
      Boolean(a.posted) &&
      a.session_id === b.session_id &&
      a.posted === b.posted
    );
    // make sure a sender is set, as we cast it just below
  }).filter(m => Boolean(m.session_id && m.posted));

  // now, check database to make sure those messages are not already fetched
  const filteredInDb = await Data.filterAlreadyFetchedOpengroupMessage(
    filtered.map(m => {
      // We have confirmed these exist by filtering above.

      return { sender: m.session_id! as string, serverTimestamp: m.posted! };
    })
  );

  window.log.debug(
    `[perf] filterDuplicatesFromDbAndIncomingV4 took ${Date.now() - start}ms for ${
      newMessages.length
    } messages;   after deduplication:${filteredInDb.length} `
  );
  const opengroupMessagesV4Filtered = filteredInDb?.map(f => {
    return newMessages.find(m => m.session_id === f.sender && m.posted === f.serverTimestamp);
  });
  return _.compact(opengroupMessagesV4Filtered) || [];
};
