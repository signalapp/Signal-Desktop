import { ConversationModel, ConversationTypeEnum } from '../../models/conversation';
import { ConversationController } from '../../session/conversations';
import { PromiseUtils } from '../../session/utils';
import { allowOnlyOneAtATime } from '../../session/utils/Promise';
import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/syncUtils';
import { arrayBufferFromFile } from '../../types/Attachment';
import { openGroupPrefix, prefixify } from '../utils/OpenGroupUtils';

interface OpenGroupParams {
  server: string;
  channel: number;
  conversationId: string;
}

export async function updateOpenGroupV1(convo: any, groupName: string, avatar: any) {
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
    const dataResized = await arrayBufferFromFile(withBlob.file);
    // const tempUrl = window.URL.createObjectURL(avatar);

    // Get file onto public chat server
    const fileObj = await API.serverAPI.putAttachment(dataResized);
    if (fileObj === null) {
      // problem
      window?.log?.warn('File upload failed');
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

export class OpenGroup {
  private static readonly serverRegex = new RegExp(
    '^((https?:\\/\\/){0,1})([\\w-]{2,}\\.){1,2}[\\w-]{2,}$'
  );
  private static readonly groupIdRegex = new RegExp(
    `^${openGroupPrefix}:[0-9]*@([\\w-]{2,}.){1,2}[\\w-]{2,}$`
  );

  public readonly server: string;
  public readonly channel: number;
  public readonly groupId?: string;
  public readonly conversationId: string;

  /**
   * An OpenGroup object.
   * If `params.server` is not valid, this will throw an `Error`.
   *
   * @param params.server The server URL. `https` will be prepended if `http` or `https` is not explicitly set
   * @param params.channel The server channel
   * @param params.groupId The string corresponding to the server. Eg. `${openGroupPrefix}1@chat.getsession.org`
   * @param params.conversationId The conversation ID for the backbone model
   */
  constructor(params: OpenGroupParams) {
    this.server = prefixify(params.server.toLowerCase());

    // Validate server format
    const isValid = OpenGroup.serverRegex.test(this.server);
    if (!isValid) {
      throw Error('an invalid server or groupId was provided');
    }

    this.channel = params.channel;
    this.conversationId = params.conversationId;
    this.groupId = OpenGroup.getGroupId(this.server, this.channel);
  }

  /**
   * Validate the URL of an open group server
   *
   * @param serverUrl The server URL to validate
   */
  public static validate(serverUrl: string): boolean {
    return this.serverRegex.test(serverUrl);
  }

  public static getAllAlreadyJoinedOpenGroupsUrl(): Array<string> {
    const convos = ConversationController.getInstance().getConversations();
    return convos
      .filter(c => !!c.get('active_at') && c.isPublic() && !c.get('left'))
      .map(c => c.id.substring((c.id as string).lastIndexOf('@') + 1)) as Array<string>;
  }

  /**
   * Try to make a new instance of `OpenGroup`.
   * This does NOT respect `ConversationController` and does not guarentee the conversation's existence.
   *
   * @param groupId The string corresponding to the server. Eg. `${openGroupPrefix}1@chat.getsession.org`
   * @param conversationId The conversation ID for the backbone model
   * @returns `OpenGroup` if valid otherwise returns `undefined`.
   */
  public static from(
    groupId: string,
    conversationId: string,
    hasSSL: boolean = true
  ): OpenGroup | undefined {
    const server = this.getServer(groupId, hasSSL);
    const channel = this.getChannel(groupId);

    // Was groupId successfully utilized?
    if (!server || !channel) {
      return;
    }

    const openGroupParams = {
      server,
      channel,
      groupId,
      conversationId,
    } as OpenGroupParams;

    const isValid = OpenGroup.serverRegex.test(server);
    if (!isValid) {
      return;
    }

    return new OpenGroup(openGroupParams);
  }

  /**
   * Join an open group
   *
   * @param server The server URL
   * @param onLoading Callback function to be called once server begins connecting
   * @returns `OpenGroup` if connection success or if already connected
   */
  public static async join(server: string, fromSyncMessage: boolean = false): Promise<void> {
    const prefixedServer = prefixify(server);
    if (!OpenGroup.validate(server)) {
      return;
    }

    // Make this not hard coded
    const channel = 1;
    let conversation;
    let conversationId;

    // Return OpenGroup if we're already connected
    conversation = OpenGroup.getConversation(prefixedServer);

    if (conversation) {
      return;
    }

    // Try to connect to server
    try {
      conversation = await PromiseUtils.timeout(
        OpenGroup.attemptConnectionOneAtATime(prefixedServer, channel),
        20000
      );

      if (!conversation) {
        throw new Error(window.i18n('connectToServerFail'));
      }
      conversationId = (conversation as any)?.cid;

      // here we managed to connect to the group.
      // if this is not a Sync Message, we should trigger one
      if (!fromSyncMessage) {
        await forceSyncConfigurationNowIfNeeded();
      }
    } catch (e) {
      throw new Error(e);
    }
  }

  /**
   * Get the conversation model of a server from its URL
   *
   * @param server The server URL
   * @returns BackBone conversation model corresponding to the server if it exists, otherwise `undefined`
   */
  public static getConversation(server: string): ConversationModel | undefined {
    if (!OpenGroup.validate(server)) {
      return;
    }
    const rawServerURL = server.replace(/^https?:\/\//i, '').replace(/[/\\]+$/i, '');
    const channelId = 1;
    const conversationId = `${openGroupPrefix}${channelId}@${rawServerURL}`;

    // Quickly peak to make sure we don't already have it
    return ConversationController.getInstance().get(conversationId);
  }

  /**
   * Check if the server exists.
   * This does not compare against your conversations with the server.
   *
   * @param server The server URL
   */
  public static async serverExists(server: string): Promise<boolean> {
    if (!OpenGroup.validate(server)) {
      return false;
    }

    const prefixedServer = prefixify(server);
    return Boolean(await window.lokiPublicChatAPI.findOrCreateServer(prefixedServer));
  }

  private static getServer(groupId: string, hasSSL: boolean): string | undefined {
    const isValid = this.groupIdRegex.test(groupId);
    const strippedServer = isValid ? groupId.split('@')[1] : undefined;

    // We don't know for sure if the server is https or http when taken from the groupId. Preifx accordingly.
    return strippedServer ? prefixify(strippedServer.toLowerCase(), hasSSL) : undefined;
  }

  private static getChannel(groupId: string): number | undefined {
    const isValid = this.groupIdRegex.test(groupId);
    const channelMatch = groupId.match(/^.*\:([0-9]*)\@.*$/);

    return channelMatch && isValid ? Number(channelMatch[1]) : undefined;
  }

  private static getGroupId(server: string, channel: number): string {
    // Server is already validated in constructor; no need to re-check

    // Strip server prefix
    const prefixRegex = new RegExp('https?:\\/\\/');
    const strippedServer = server.replace(prefixRegex, '');

    return `${openGroupPrefix}${channel}@${strippedServer}`;
  }

  /**
   * When we get our configuration from the network, we might get a few times the same open group on two different messages.
   * If we don't do anything, we will join them multiple times.
   * Even if the convo exists only once, the lokiPublicChat API will have several instances polling for the same open group.
   * Which will cause a lot of duplicate messages as they will be merged on a single conversation.
   *
   * To avoid this issue, we allow only a single join of a specific opengroup at a time.
   */
  private static async attemptConnectionOneAtATime(
    serverUrl: string,
    channelId: number = 1
  ): Promise<ConversationModel> {
    if (!serverUrl) {
      throw new Error('Cannot join open group with empty URL');
    }
    const oneAtaTimeStr = `oneAtaTimeOpenGroupJoin:${serverUrl}${channelId}`;
    return allowOnlyOneAtATime(oneAtaTimeStr, async () => {
      return OpenGroup.attemptConnection(serverUrl, channelId);
    });
  }

  // Attempts a connection to an open group server
  private static async attemptConnection(
    serverUrl: string,
    channelId: number
  ): Promise<ConversationModel> {
    let completeServerURL = serverUrl.toLowerCase();
    const valid = OpenGroup.validate(completeServerURL);
    if (!valid) {
      return new Promise((_resolve, reject) => {
        reject(window.i18n('connectToServerFail'));
      });
    }

    // Add http or https prefix to server
    completeServerURL = prefixify(completeServerURL);

    const rawServerURL = serverUrl.replace(/^https?:\/\//i, '').replace(/[/\\]+$/i, '');

    const conversationId = `${openGroupPrefix}${channelId}@${rawServerURL}`;

    // Quickly peak to make sure we don't already have it
    const conversationExists = ConversationController.getInstance().get(conversationId);
    if (conversationExists) {
      // We are already a member of this public chat
      return new Promise((_resolve, reject) => {
        reject(window.i18n('publicChatExists'));
      });
    }

    // Get server
    const serverAPI = await window.lokiPublicChatAPI.findOrCreateServer(completeServerURL);
    // SSL certificate failure or offline
    if (!serverAPI) {
      // Url incorrect or server not compatible
      return new Promise((_resolve, reject) => {
        reject(window.i18n('connectToServerFail'));
      });
    }

    // Create conversation
    const conversation = await ConversationController.getInstance().getOrCreateAndWait(
      conversationId,
      ConversationTypeEnum.GROUP // keep a group for this one as this is an old open group
    );

    // Convert conversation to a public one
    await conversation.setPublicSource(completeServerURL, channelId);

    // and finally activate it
    void conversation.getPublicSendData(); // may want "await" if you want to use the API

    return conversation;
  }
}
