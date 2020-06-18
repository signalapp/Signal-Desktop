declare class LokiMessageAPI {
  constructor(ourKey: string);
  sendMessage(
    pubKey: string,
    data: Uint8Array,
    messageTimeStamp: number,
    ttl: number
  ): Promise<void>;
}

export default LokiMessageAPI;
