import { sign } from 'curve25519-js';
import { SessionKeyPair } from '../../../../receiver/keypairs';
import { callUtilsWorker } from '../../../../webworker/workers/browser/util_worker_interface';
import { getSodiumRenderer } from '../../../crypto';
import { UserUtils } from '../../../utils';
import { fromBase64ToArray, fromHexToArray } from '../../../utils/String';
import { SogsBlinding } from '../sogsv3/sogsBlinding';

export class OpenGroupMessageV2 {
  public serverId?: number;
  public sender?: string;
  public sentTimestamp: number;
  public base64EncodedData: string;
  public base64EncodedSignature?: string;
  public filesToLink?: Array<number>;

  constructor(messageData: {
    serverId?: number;
    sender?: string;
    sentTimestamp: number;
    base64EncodedData: string;
    base64EncodedSignature?: string;
    filesToLink?: Array<number>;
  }) {
    const {
      base64EncodedData,
      sentTimestamp,
      base64EncodedSignature,
      sender,
      serverId,
      filesToLink,
    } = messageData;

    this.base64EncodedData = base64EncodedData;
    this.sentTimestamp = sentTimestamp;
    this.base64EncodedSignature = base64EncodedSignature;
    this.sender = sender;
    this.serverId = serverId;
    this.filesToLink = filesToLink;
  }

  public static fromJson(json: Record<string, any>) {
    const {
      data: base64EncodedData,
      timestamp: sentTimestamp,
      server_id: serverId,
      public_key: sender,
      signature: base64EncodedSignature,
      files: filesToLink,
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
      filesToLink,
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
      filesToLink: this.filesToLink,
    });
  }

  public async signWithBlinding(serverPubKey: string): Promise<OpenGroupMessageV2> {
    const signingKeys = await UserUtils.getUserED25519KeyPairBytes();

    if (!signingKeys) {
      throw new Error('signWithBlinding: getUserED25519KeyPairBytes returned nothing');
    }

    const sodium = await getSodiumRenderer();
    const blindedKeyPair = SogsBlinding.getBlindingValues(
      fromHexToArray(serverPubKey),
      signingKeys,
      sodium
    );

    if (!blindedKeyPair) {
      throw new Error('signWithBlinding: getBlindedPubKey returned nothing');
    }
    const data = fromBase64ToArray(this.base64EncodedData);

    const signature = await SogsBlinding.getSogsSignature({
      blinded: true,
      ka: blindedKeyPair.secretKey,
      kA: blindedKeyPair.publicKey,
      toSign: data,
      signingKeys,
    });
    if (!signature || signature.length === 0) {
      throw new Error("Couldn't sign message");
    }
    const base64Sig = await callUtilsWorker('arrayBufferToStringBase64', signature);

    return new OpenGroupMessageV2({
      base64EncodedData: this.base64EncodedData,
      sentTimestamp: this.sentTimestamp,
      base64EncodedSignature: base64Sig,
      sender: this.sender, // might need to be blindedPubkey
      serverId: this.serverId,
      filesToLink: this.filesToLink,
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

    if (this.filesToLink) {
      json.files = this.filesToLink;
    }
    return json;
  }

  public toBlindedMessageRequestJson() {
    const json = {
      message: this.base64EncodedData,
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
    if (this.filesToLink) {
      json.files = this.filesToLink;
    }
    return json;
  }
}
