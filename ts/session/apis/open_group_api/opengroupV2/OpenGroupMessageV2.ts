import { sign } from 'curve25519-js';
import { SessionKeyPair } from '../../../../receiver/keypairs';
import { callUtilsWorker } from '../../../../webworker/workers/util_worker_interface';
import { fromBase64ToArray } from '../../../utils/String';

export class OpenGroupMessageV2 {
  public serverId?: number;
  public sender?: string;
  public sentTimestamp: number;
  public base64EncodedData: string;
  public base64EncodedSignature?: string;

  constructor(messageData: {
    serverId?: number;
    sender?: string;
    sentTimestamp: number;
    base64EncodedData: string;
    base64EncodedSignature?: string;
  }) {
    const {
      base64EncodedData,
      sentTimestamp,
      base64EncodedSignature,
      sender,
      serverId,
    } = messageData;

    this.base64EncodedData = base64EncodedData;
    this.sentTimestamp = sentTimestamp;
    this.base64EncodedSignature = base64EncodedSignature;
    this.sender = sender;
    this.serverId = serverId;
  }

  public static fromJson(json: Record<string, any>) {
    const {
      data: base64EncodedData,
      timestamp: sentTimestamp,
      server_id: serverId,
      public_key: sender,
      signature: base64EncodedSignature,
    } = json;

    if (!base64EncodedData || !sentTimestamp) {
      window?.log?.info('invalid json to build OpenGroupMessageV2');
      throw new Error('OpengroupV2Message fromJson() failed');
    }
    return new OpenGroupMessageV2({
      base64EncodedData,
      base64EncodedSignature,
      sentTimestamp,
      serverId,
      sender,
    });
  }
  public async sign(ourKeyPair: SessionKeyPair | undefined): Promise<OpenGroupMessageV2> {
    if (!ourKeyPair) {
      window?.log?.warn("Couldn't find user X25519 key pair.");
      throw new Error("Couldn't sign message");
    }

    const data = fromBase64ToArray(this.base64EncodedData);
    const signature = sign(new Uint8Array(ourKeyPair.privKey), data, null);
    if (!signature || signature.length === 0) {
      throw new Error("Couldn't sign message");
    }
    const base64Sig = await callUtilsWorker('arrayBufferToStringBase64', signature);
    return new OpenGroupMessageV2({
      base64EncodedData: this.base64EncodedData,
      sentTimestamp: this.sentTimestamp,
      base64EncodedSignature: base64Sig,
      sender: this.sender,
      serverId: this.serverId,
    });
  }

  public toJson() {
    const json = {
      data: this.base64EncodedData,
      timestamp: this.sentTimestamp,
    } as Record<string, any>;
    if (this.serverId) {
      json.server_id = this.serverId;
    }
    if (this.sender) {
      json.public_key = this.sender;
    }
    if (this.base64EncodedSignature) {
      json.signature = this.base64EncodedSignature;
    }
    return json;
  }
}
