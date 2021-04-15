import {
  Quote,
  AttachmentPointer,
  Preview,
} from '../../ts/session/messages/outgoing';

interface UploadResponse {
  url: string;
  id?: number;
}

export interface LokiAppDotNetServerInterface {
  setAvatar(url: any, profileKey: any);
  findOrCreateChannel(
    api: LokiPublicChatFactoryAPI,
    channelId: number,
    conversationId: string
  ): Promise<LokiPublicChannelAPI>;
  uploadData(data: FormData): Promise<UploadResponse>;
  uploadAvatar(data: FormData): Promise<UploadResponse>;
  putAttachment(data: ArrayBuffer): Promise<UploadResponse>;
  putAvatar(data: ArrayBuffer): Promise<UploadResponse>;
  downloadAttachment(url: String): Promise<ArrayBuffer>;
  serverRequest(endpoint: string): Promise<any>;
}

export interface LokiPublicChannelAPI {
  banUser(source: string): Promise<boolean>;
  getModerators: () => Promise<Array<string>>;
  serverAPI: any;
  deleteMessages(arg0: any[]);
  sendMessage(
    data: {
      quote?: Quote;
      attachments: Array<AttachmentPointer>;
      preview: Array<Preview>;
      body?: string;
    },
    timestamp: number
  ): Promise<{ serverId; serverTimestamp }>;
}

declare class LokiAppDotNetServerAPI implements LokiAppDotNetServerInterface {
  public baseServerUrl: string;
  constructor(ourKey: string, url: string);
}

export default LokiAppDotNetServerAPI;
