import { OpenGroupData } from '../../data/opengroups';
import { downloadAttachmentSogsV3 } from '../../receiver/attachments';
import { MIME } from '../../types';
import { urlToBlob } from '../../types/attachments/VisualAttachment';
import { processNewAttachment } from '../../types/MessageAttachment';
import { uploadImageForRoomSogsV3 } from '../apis/open_group_api/sogsv3/sogsV3RoomImage';
import { getConversationController } from '../conversations';

export type OpenGroupUpdateAvatar = { objectUrl: string | null };

/**
 * This function is only called when the local user makes a change to an open group.
 * So this function is not called on group updates from the network, even from another of our devices.
 */
export async function initiateOpenGroupUpdate(
  groupId: string,
  groupName: string,
  avatar: OpenGroupUpdateAvatar
) {
  // we actually do not change the groupName just yet here, serverSide. This is just done client side. Maybe something to allow in a later release.
  // For now, the UI is actually not allowing changing the room name so we do not care.
  const convo = getConversationController().get(groupId);

  if (!convo?.isPublic()) {
    throw new Error('initiateOpenGroupUpdate can only be used for communities');
  }
  if (avatar && avatar.objectUrl) {
    const blobAvatarAlreadyScaled = await urlToBlob(avatar.objectUrl);

    const dataResized = await blobAvatarAlreadyScaled.arrayBuffer();
    const roomInfos = OpenGroupData.getV2OpenGroupRoom(convo.id);
    if (!roomInfos || !dataResized.byteLength) {
      return false;
    }
    const uploadedFileDetails = await uploadImageForRoomSogsV3(
      new Uint8Array(dataResized),
      roomInfos
    );

    if (!uploadedFileDetails || !uploadedFileDetails.fileUrl) {
      window?.log?.warn('File opengroupv2 upload failed');
      return false;
    }
    try {
      const { fileId: avatarImageId, fileUrl } = uploadedFileDetails;

      // this is kind of a hack just made to avoid having a specific function downloading from sogs by URL rather than fileID
      const downloaded = await downloadAttachmentSogsV3(
        { id: avatarImageId, size: null, url: fileUrl },
        roomInfos
      );

      if (!downloaded || !(downloaded.data instanceof ArrayBuffer)) {
        const typeFound = typeof downloaded;
        throw new Error(`Expected a plain ArrayBuffer but got ${typeFound}`);
      }
      const data = downloaded.data;
      if (!downloaded.data?.byteLength) {
        window?.log?.error('Failed to download attachment. Length is 0');
        throw new Error(
          `Failed to download attachment. Length is 0 for ${uploadedFileDetails.fileUrl}`
        );
      }

      const upgraded = await processNewAttachment({
        data,
        isRaw: true,
        contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
      });
      await convo.setSessionProfile({
        displayName: groupName || convo.get('displayNameInProfile') || window.i18n('unknown'),
        avatarPath: upgraded.path,
        avatarImageId,
      });
    } catch (e) {
      window?.log?.error(`Could not decrypt profile image: ${e}`);
      return false;
    }
  }
  return true;
}
