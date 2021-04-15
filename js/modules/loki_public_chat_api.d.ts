import {
  LokiAppDotNetServerInterface,
  LokiPublicChannelAPI,
} from './loki_app_dot_net_api';

export interface LokiPublicChatFactoryInterface {
  ourKey: string;
  openGroupPubKeys: { [key: string]: string };
  findOrCreateServer(url: string): Promise<LokiAppDotNetServerInterface | null>;
  findOrCreateChannel(
    url: string,
    channelId: number,
    conversationId: string
  ): Promise<LokiPublicChannelAPI | null>;
  getListOfMembers(): Promise<
    Array<{ authorPhoneNumber: string; authorProfileName?: string }>
  >;
  setListOfMembers(
    members: Array<{ authorPhoneNumber: string; authorProfileName?: string }>
  );
}

declare class LokiPublicChatFactoryAPI
  implements LokiPublicChatFactoryInterface {
  constructor(ourKey: string);
}

export default LokiPublicChatFactoryAPI;
