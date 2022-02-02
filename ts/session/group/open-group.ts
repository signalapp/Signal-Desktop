import { getV2OpenGroupRoom } from '../../data/opengroups';
import { downloadDataFromOpenGroupV2 } from '../../receiver/attachments';
import { MIME } from '../../types';
import { urlToBlob } from '../../types/attachments/VisualAttachment';
import { processNewAttachment } from '../../types/MessageAttachment';
import { ApiV2 } from '../apis/open_group_api/opengroupV2';
import { getConversationController } from '../conversations';
import { sha256 } from '../crypto';
import { fromArrayBufferToBase64 } from '../utils/String';

export type OpenGroupUpdateAvatar = { objectUrl: string | null };

/**
 * This function is only called when the local user makes a change to an open group.
 * So this function is not called on group updates from the network, even from another of our devices.
 *
 */
export async function initiateOpenGroupUpdate(
  groupId: string,
  groupName: string,
  avatar: OpenGroupUpdateAvatar
) {
  const convo = getConversationController().get(groupId);

  if (!convo || !convo.isPublic() || !convo.isOpenGroupV2()) {
    throw new Error('Only opengroupv2 are supported');
  }
  if (avatar && avatar.objectUrl) {
    const blobAvatarAlreadyScaled = await urlToBlob(avatar.objectUrl);

    const dataResized = await blobAvatarAlreadyScaled.arrayBuffer();
    const roomInfos = await getV2OpenGroupRoom(convo.id);
    if (!roomInfos || !dataResized.byteLength) {
      return false;
    }
    const uploadedFileDetails = await ApiV2.uploadImageForRoomOpenGroupV2(
      new Uint8Array(dataResized),
      roomInfos
    );

    if (!uploadedFileDetails || !uploadedFileDetails.fileUrl) {
      window?.log?.warn('File opengroupv2 upload failed');
      return false;
    }
    let url: URL;
    try {
      url = new URL(uploadedFileDetails.fileUrl);

      const pathname = url.pathname;
      const downloaded = await downloadDataFromOpenGroupV2(pathname, roomInfos);
      if (!(downloaded instanceof Uint8Array)) {
        const typeFound = typeof downloaded;
        throw new Error(`Expected a plain Uint8Array but got ${typeFound}`);
      }

      const upgraded = await processNewAttachment({
        data: downloaded.buffer,
        isRaw: true,
        contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
      });
      const newHash = sha256(fromArrayBufferToBase64(downloaded.buffer));
      await convo.setLokiProfile({
        displayName: groupName || convo.get('name') || 'Unknown',
        avatar: upgraded.path,
        avatarHash: newHash,
      });
    } catch (e) {
      window?.log?.error(`Could not decrypt profile image: ${e}`);
      return false;
    }
  }
  return true;
}
