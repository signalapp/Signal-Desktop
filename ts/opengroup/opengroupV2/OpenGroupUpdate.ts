import { ApiV2 } from '.';
import { getV2OpenGroupRoom } from '../../data/opengroups';
import { ConversationModel } from '../../models/conversation';
import { downloadAttachmentOpenGroupV2 } from '../../receiver/attachments';
import { arrayBufferFromFile } from '../../types/Attachment';
import { AttachmentUtil } from '../../util';

export async function updateOpenGroupV2(convo: ConversationModel, groupName: string, avatar: any) {
  if (avatar) {
    // I hate duplicating this...
    const readFile = async (attachment: any) =>
      new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = (e: any) => {
          const data = e.target.result;
          resolve({
            ...attachment,
            data,
            size: data.byteLength,
          });
        };
        fileReader.onerror = reject;
        fileReader.onabort = reject;
        fileReader.readAsArrayBuffer(attachment.file);
      });
    const avatarAttachment: any = await readFile({ file: avatar });

    // We want a square
    const withBlob = await AttachmentUtil.autoScale(
      {
        contentType: avatar.type,
        file: new Blob([avatarAttachment.data], {
          type: avatar.contentType,
        }),
      },
      {
        maxSide: 640,
        maxSize: 1000 * 1024,
      }
    );
    const dataResized = await arrayBufferFromFile(withBlob.file);
    const roomInfos = await getV2OpenGroupRoom(convo.id);
    if (!roomInfos || !dataResized.byteLength) {
      return false;
    }
    const uploadedFileDetails = await ApiV2.uploadImageForRoomOpenGroupV2(
      new Uint8Array(dataResized),
      roomInfos
    );

    if (!uploadedFileDetails || !uploadedFileDetails.fileUrl) {
      window.log.warn('File opengroupv2 upload failed');
      return;
    }
    let url: URL;
    try {
      url = new URL(uploadedFileDetails.fileUrl);

      const pathname = url.pathname;
      const downloaded = await downloadAttachmentOpenGroupV2(pathname, roomInfos);
      if (!(downloaded instanceof Uint8Array)) {
        const typeFound = typeof downloaded;
        throw new Error(`Expected a plain Uint8Array but got ${typeFound}`);
      }

      const upgraded = await window.Signal.Migrations.processNewAttachment({
        data: downloaded.buffer,
        isRaw: true,
        url: pathname,
      });
      // TODO on our opengroupv2 we don't have a way to know when the file changed on the server.
      // maybe we should download it once in a while even if we don't know if the file changed?
      convo.set('avatarPointer', pathname);

      window.log.warn('TODO update of roomName');
      await convo.setGroupNameAndAvatar(convo.get('name') || 'Unknown', upgraded.path);
    } catch (e) {
      window.log.error(`Could not decrypt profile image: ${e}`);
    }
  }

  return undefined;
}
