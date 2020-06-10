// This is the Open Group equivalent to the PubKey type.

interface OpenGroupParams {
  server?: string;
  channel?: number;
  conversationId: string;
}

export class OpenGroup {
  private static readonly conversationIdRegex: RegExp = new RegExp('^publicChat:[0-9]*@([\\w-]{2,}.){1,2}[\\w-]{2,}$');
  public readonly server: string;
  public readonly channel: number;
  public readonly conversationId: string;
  private readonly isValid: boolean;

  constructor(params: OpenGroupParams) {
    this.isValid = OpenGroup.validate(params);

    if (!this.isValid) {
      throw Error('an invalid conversationId was provided');
    }

    this.conversationId = params.conversationId;
    this.server = params.server ?? this.getServer(params.conversationId);
    this.channel = params.channel ?? this.getChannel(params.conversationId);
  }

  public static from(conversationId: string): OpenGroup | undefined {
    // Returns a new instance if conversationId is valid
    if (OpenGroup.validate({conversationId})) {
      return new OpenGroup({conversationId});
    }

    return undefined;
  }

  private static validate(openGroup: OpenGroupParams): boolean {
    // Validate conversationId
    const { server, channel, conversationId } = openGroup;

    if (!this.conversationIdRegex.test(conversationId)) {
      return false;
    }

    // Validate channel and server if provided
    if (server && channel) {
      const contrivedId = `publicChat:${String(channel)}@${server}`;
      if (contrivedId !== conversationId) {
        return false;
      }
    }

    return true;
  }

  private getServer(conversationId: string): string {
    // conversationId is already validated in constructor; no need to re-check
    return conversationId.split('@')[1];
  }

  private getChannel(conversationId: string): number {
    // conversationId is already validated in constructor; no need to re-check
    const channelMatch = conversationId.match(/^.*\:([0-9]*)\@.*$/);

    return channelMatch ? Number(channelMatch[1]) : 1;
  }
}
