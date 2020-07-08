// This is the Open Group equivalent to the PubKey type.

interface OpenGroupParams {
  server: string;
  channel: number;
  conversationId: string;
}

export class OpenGroup {
  // Matches prefixes https:// http:// plus no prefix.
  // Servers without prefix default to https://
  private static readonly serverRegex = new RegExp(
    '^((https?:\\/\\/){0,1})([\\w-]{2,}\\.){1,2}[\\w-]{2,}$'
  );
  private static readonly groupIdRegex = new RegExp(
    '^publicChat:[0-9]*@([\\w-]{2,}.){1,2}[\\w-]{2,}$'
  );
  public readonly server: string;
  public readonly channel: number;
  public readonly groupId?: string;
  public readonly conversationId: string; // eg. c12

  constructor(params: OpenGroupParams) {
    // https will be prepended unless explicitly http
    this.server = OpenGroup.prefixify(params.server.toLowerCase());

    // Validate server format
    const isValid = OpenGroup.serverRegex.test(this.server);
    if (!isValid) {
      throw Error('an invalid server or groupId was provided');
    }

    this.channel = params.channel;
    this.conversationId = params.conversationId;
    this.groupId = OpenGroup.getGroupId(this.server, this.channel);
  }

  public static validate(serverUrl: string): boolean {
    return this.serverRegex.test(serverUrl);
  }

  public static from(
    groupId: string,
    conversationId: string,
    hasSSL: boolean = true
  ): OpenGroup | undefined {
    // Returns a new instance from a groupId if it's valid
    // eg. groupId = 'publicChat:1@chat.getsession.org'

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

  public static async join(
    server: string,
    onLoading?: any
  ): Promise<OpenGroup | undefined> {
    // onLoading called when the server begins connecting - after passing every guard

    const prefixedServer = OpenGroup.prefixify(server);
    if (!OpenGroup.validate(server)) {
      return;
    }

    // Make this not hard coded
    const channel = 1;
    let conversation;
    let conversationId;

    // Return OpenGroup if we're already connected
    conversation = await OpenGroup.getConversation(prefixedServer);
    if (conversation) {
      conversationId = conversation?.cid;
      if (conversationId) {
        return new OpenGroup({
          server: prefixedServer,
          channel: 1,
          conversationId,
        });
      }
    }

    // Try to connect to server
    try {
      if (onLoading) {
        onLoading();
      }

      conversation = await window.attemptConnection(prefixedServer, channel);
      conversationId = conversation?.cid;
    } catch (e) {
      throw new Error(e);
    }

    // Do we want to add conversation as a property of OpenGroup?
    return new OpenGroup({
      server,
      channel,
      conversationId,
    });
  }

  public static async getConversation(server: string): Promise<any> {
    if (!OpenGroup.validate(server)) {
      return;
    }

    const prefixedServer = this.prefixify(server);
    const serverInfo = (await window.lokiPublicChatAPI.findOrCreateServer(
      prefixedServer
    )) as any;

    if (!serverInfo?.channels?.length) {
      return;
    }

    return serverInfo.channels[0].conversation;
  }

  public static async serverExists(server: string): Promise<boolean> {
    if (!OpenGroup.validate(server)) {
      return false;
    }

    const prefixedServer = this.prefixify(server);
    return Boolean(
      await window.lokiPublicChatAPI.findOrCreateServer(prefixedServer)
    );
  }

  public static getConversationByCID(conversationId: string): any {
    const { ConversationController } = window;
    return ConversationController.get(conversationId);
  }

  private static getServer(
    groupId: string,
    hasSSL: boolean
  ): string | undefined {
    const isValid = this.groupIdRegex.test(groupId);
    const strippedServer = isValid ? groupId.split('@')[1] : undefined;

    // We don't know for sure if the server is https or http when taken from the groupId. Preifx accordingly.
    return strippedServer
      ? this.prefixify(strippedServer.toLowerCase(), hasSSL)
      : undefined;
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

    return `publicChat:${channel}@${strippedServer}`;
  }

  private static prefixify(server: string, hasSSL: boolean = true): string {
    // Prefix server with https:// if it's not already prefixed with http or https.
    const hasPrefix = server.match('^https?://');
    if (hasPrefix) {
      return server;
    }

    return `http${hasSSL ? 's' : ''}://${server}`;
  }
}
