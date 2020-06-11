// This is the Open Group equivalent to the PubKey type.

interface OpenGroupParams {
  server: string;
  channel: number;
  conversationId: string;
}

export class OpenGroup {
  private static readonly serverRegex = new RegExp('^([\\w-]{2,}.){1,2}[\\w-]{2,}$');
  private static readonly groupIdRegex = new RegExp('^publicChat:[0-9]*@([\\w-]{2,}.){1,2}[\\w-]{2,}$');
  public readonly server: string;
  public readonly channel: number;
  public readonly groupId?: string;
  public readonly conversationId: string;
  private readonly isValid: boolean;

  constructor(params: OpenGroupParams) {
    this.isValid = OpenGroup.validate(params);

    if (!this.isValid) {
      throw Error('an invalid server or groupId was provided');
    }

    const strippedServer = params.server.replace('https://', '');

    this.server = strippedServer;
    this.channel = params.channel;
    this.conversationId = params.conversationId;
    this.groupId = OpenGroup.getGroupId(this.server, this.channel);
  }

  public static from(groupId: string, conversationId: string): OpenGroup | undefined {
    // Returns a new instance from a groupId if it's valid
    // eg. groupId = 'publicChat:1@chat.getsession.org'

    // Valid groupId?
    if (!this.groupIdRegex.test(groupId)) {
      return;
    }

    const openGroupParams = {
      server: this.getServer(groupId),
      channel: this.getChannel(groupId),
      groupId,
      conversationId,
    };

    if (this.validate(openGroupParams)) {
      return new OpenGroup(openGroupParams);
    }

    return;
  }

  private static validate(openGroup: OpenGroupParams): boolean {
    // Validate that all the values match by rebuilding groupId.
    const { server } = openGroup;

    // Valid server?
    if (!this.serverRegex.test(server)) {
      return false;
    }

    return true;
  }

  private static getServer(groupId: string): string {
    // groupId is already validated in constructor; no need to re-check
    return groupId.split('@')[1];
  }

  private static getChannel(groupId: string): number {
    // groupId is already validated in constructor; no need to re-check
    const channelMatch = groupId.match(/^.*\:([0-9]*)\@.*$/);

    return channelMatch ? Number(channelMatch[1]) : 1;
  }

  private static getGroupId(server: string, channel: number): string {
    // server is already validated in constructor; no need to re-check
    return `publicChat:${channel}@${server}`;
  }
}
