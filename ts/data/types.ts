export type IdentityKey = {
  id: string;
  publicKey: ArrayBuffer;
  firstUse: boolean;
  nonblockingApproval: boolean;
  secretKey?: string; // found in medium groups
};

export type GuardNode = {
  ed25519PubKey: string;
};

export interface Snode {
  ip: string;
  port: number;
  pubkey_x25519: string;
  pubkey_ed25519: string;
  storage_server_version: Array<number>;
}

export type SwarmNode = Snode & {
  address: string;
};

export type OpenGroupV2Room = {
  serverUrl: string;

  /** this is actually shared for all this server's room */
  serverPublicKey: string;
  roomId: string;

  /** a user displayed name */
  roomName?: string;

  /** the fileId of the group room's image */
  imageID?: string;

  /** the linked ConversationModel.id */
  conversationId?: string;
  maxMessageFetchedSeqNo?: number;
  lastInboxIdFetched?: number;
  lastOutboxIdFetched?: number;

  /**
   * This value is set with the current timestamp whenever we get new messages.
   */
  lastFetchTimestamp?: number;

  /**
   * This is shared across all rooms in a server.
   */
  capabilities?: Array<string>;
};

export type OpenGroupRequestCommonType = {
  serverUrl: string;
  roomId: string;
};
