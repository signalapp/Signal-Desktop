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
    '^(https?:\\/\\/){0,1}([\\w-]{2,}.){1,2}[\\w-]{2,}$'
  );
  private static readonly groupIdRegex = new RegExp(
    '^publicChat:[0-9]*@([\\w-]{2,}.){1,2}[\\w-]{2,}$'
  );
  public readonly server: string;
  public readonly channel: number;
  public readonly groupId?: string;
  public readonly conversationId: string;
  private readonly rawServer: string;

  constructor(params: OpenGroupParams) {
    // https will be prepended unless explicitly http
    const prefixRegex = new RegExp('https:\//\//');
    this.rawServer = params.server.replace(prefixRegex, '');
    
    const isHttps = Boolean(params.server.match('^(https:\/\/){1}'));
    const isHttp = Boolean(params.server.match('^(http:\/\/){1}'));
    const hasNoPrefix = !(params.server.match(prefixRegex));

    console.log('[vince] isHttps:', isHttps);
    console.log('[vince] isHttp:', isHttp);
    console.log('[vince] hasNoPrefix:', hasNoPrefix);

    this.server = params.server;

    // Validate server format
    const isValid = OpenGroup.serverRegex.test(this.server);
    if (!isValid) {
      throw Error('an invalid server or groupId was provided');
    }

    console.log('[vince] OpenGroup --> constructor:', this.server);

    this.channel = params.channel;
    this.conversationId = params.conversationId;
    this.groupId = OpenGroup.getGroupId(this.server, this.channel);
  }

  public static from(
    groupId: string,
    conversationId: string
  ): OpenGroup | undefined {
    // Returns a new instance from a groupId if it's valid
    // eg. groupId = 'publicChat:1@chat.getsession.org'

    const server = this.getServer(groupId);
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

    if (this.serverRegex.test(server)) {
      return;
    }

    return new OpenGroup(openGroupParams);
  }

  private static getServer(groupId: string): string | undefined {
    const isValid = this.groupIdRegex.test(groupId);

    return isValid ? groupId.split('@')[1] : undefined;
  }

  private static getChannel(groupId: string): number | undefined {
    const isValid = this.groupIdRegex.test(groupId);
    const channelMatch = groupId.match(/^.*\:([0-9]*)\@.*$/);

    return channelMatch && isValid ? Number(channelMatch[1]) : undefined;
  }

  private static getGroupId(server: string, channel: number): string {
    // server is already validated in constructor; no need to re-check
    return `publicChat:${channel}@${server}`;
  }
}
