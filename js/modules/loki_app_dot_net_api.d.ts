import {
  Quote,
  AttachmentPointer,
  Preview,
} from '../../ts/session/messages/outgoing';

declare class LokiAppDotNetServerAPI {
  constructor(ourKey: string, url: string);
  findOrCreateChannel(
    api: LokiPublicChatFactoryAPI,
    channelId: number,
    conversationId: string
  ): Promise<LokiPublicChannelAPI>;
}

export interface LokiPublicChannelAPI {
  sendMessage(
    data: {
      quote?: Quote;
      attachments: Array<AttachmentPointer>;
      preview: Array<Preview>;
      body?: string;
    },
    timestamp: number
  ): Promise<boolean>;
}

export default LokiAppDotNetServerAPI;
