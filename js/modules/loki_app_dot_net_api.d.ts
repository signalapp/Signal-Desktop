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
  ): Promise<{ serverId; serverTimestamp }>;
}

declare class LokiAppDotNetServerAPI implements LokiAppDotNetServerInterface {
  public baseServerUrl: string;
  constructor(ourKey: string, url: string);
}

export default LokiAppDotNetServerAPI;
