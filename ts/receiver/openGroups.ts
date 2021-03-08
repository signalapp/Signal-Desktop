export async function updateOpenGroup(
  convo: any,
  groupName: string,
  avatar: any
) {
  const API = await convo.getPublicSendData();

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

    // We want a square for iOS
    const withBlob = await window.Signal.Util.AttachmentUtil.autoScale(
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
    const dataResized = await window.Signal.Types.Attachment.arrayBufferFromFile(
      withBlob.file
    );
    // const tempUrl = window.URL.createObjectURL(avatar);

    // Get file onto public chat server
    const fileObj = await API.serverAPI.putAttachment(dataResized);
    if (fileObj === null) {
      // problem
      window.log.warn('File upload failed');
      return;
    }

    // lets not allow ANY URLs, lets force it to be local to public chat server
    const url = new URL(fileObj.url);

    // write it to the channel
    await API.setChannelAvatar(url.pathname);
  }

  if (await API.setChannelName(groupName)) {
    // queue update from server
    // and let that set the conversation
    API.pollForChannelOnce();
    // or we could just directly call
    // convo.setGroupName(groupName);
    // but gut is saying let the server be the definitive storage of the state
    // and trickle down from there
  }
}
