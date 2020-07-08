export interface LokiMessageInterface {
  sendMessage(
    pubKey: string,
    data: Uint8Array,
    messageTimeStamp: number,
    ttl: number
  ): Promise<void>;
}

declare class LokiMessageAPI implements LokiMessageInterface {
  constructor(ourKey: string);
}

export default LokiMessageAPI;
