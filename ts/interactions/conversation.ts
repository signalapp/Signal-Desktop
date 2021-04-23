import {
  getCompleteUrlFromRoom,
  openGroupPrefixRegex,
  openGroupV2ConversationIdRegex,
} from '../opengroup/utils/OpenGroupUtils';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { ToastUtils } from '../session/utils';

export async function copyPublicKey(convoId: string) {
  if (convoId.match(openGroupPrefixRegex)) {
    // open group v1 or v2
    if (convoId.match(openGroupV2ConversationIdRegex)) {
      // this is a v2 group, just build the url
      const roomInfos = await getV2OpenGroupRoom(convoId);
      if (roomInfos) {
        const fullUrl = getCompleteUrlFromRoom(roomInfos);
        window.clipboard.writeText(fullUrl);

        ToastUtils.pushCopiedToClipBoard();
        return;
      }
      window.log.warn('coy to pubkey no roomInfo');
      return;
    }

    // this is a v1
    const atIndex = convoId.indexOf('@');
    const openGroupUrl = convoId.substr(atIndex + 1);
    window.clipboard.writeText(openGroupUrl);

    ToastUtils.pushCopiedToClipBoard();
    return;
  }
  window.clipboard.writeText(convoId);

  ToastUtils.pushCopiedToClipBoard();
}
