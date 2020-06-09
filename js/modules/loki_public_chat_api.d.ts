import { LokiPublicChannelAPI } from './loki_app_dot_net_api';

declare class LokiPublicChatFactoryAPI {
  constructor(ourKey: string);
  findOrCreateServer(url: string): Promise<void>;
  findOrCreateChannel(
    url: string,
    channelId: number,
    conversationId: string
  ): Promise<LokiPublicChannelAPI>;
}

export default LokiPublicChatFactoryAPI;
