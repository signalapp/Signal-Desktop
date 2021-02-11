import { KeyPair } from '../../libtextsecure/libsignal-protocol';
import { MessageCollection } from '../../ts/models/message';
import { HexKeyPair } from '../../ts/receiver/closedGroups';
import { ECKeyPair } from '../../ts/receiver/keypairs';
import { PubKey } from '../../ts/session/types';
import { ConversationType } from '../../ts/state/ducks/conversations';
import { Message } from '../../ts/types/Message';

export type IdentityKey = {
  id: string;
  publicKey: ArrayBuffer;
  firstUse: boolean;
  nonblockingApproval: boolean;
  secretKey?: string; // found in medium groups
};

export type PreKey = {
  id: number;
  publicKey: ArrayBuffer;
  privateKey: ArrayBuffer;
  recipient: string;
};

export type SignedPreKey = {
  id: number;
  publicKey: ArrayBuffer;
  privateKey: ArrayBuffer;
  created_at: number;
  confirmed: boolean;
  signature: ArrayBuffer;
};

export type ContactPreKey = {
  id: number;
  identityKeyString: string;
  publicKey: ArrayBuffer;
  keyId: number;
};

export type ContactSignedPreKey = {
  id: number;
  identityKeyString: string;
  publicKey: ArrayBuffer;
  keyId: number;
  signature: ArrayBuffer;
  created_at: number;
  confirmed: boolean;
};

export type GuardNode = {
  ed25519PubKey: string;
};

export type SwarmNode = {
  address: string;
  ip: string;
  port: string;
  pubkey_ed25519: string;
  pubkey_x25519: string;
};

export type StorageItem = {
  id: string;
  value: any;
};

export type SessionDataInfo = {
  id: string;
  number: string;
  deviceId: number;
  record: string;
};

export type ServerToken = {
  serverUrl: string;
  token: string;
};

// Basic
export function searchMessages(query: string): Promise<Array<any>>;
export function searchConversations(query: string): Promise<Array<any>>;
export function shutdown(): Promise<void>;
export function close(): Promise<void>;
export function removeDB(): Promise<void>;
export function removeIndexedDBFiles(): Promise<void>;
export function getPasswordHash(): Promise<string | null>;

// Identity Keys
// TODO: identity key has different shape depending on how it is called,
// so we need to come up with a way to make TS work with all of them
export function createOrUpdateIdentityKey(data: any): Promise<void>;
export function getIdentityKeyById(id: string): Promise<IdentityKey | null>;
export function bulkAddIdentityKeys(array: Array<IdentityKey>): Promise<void>;
export function removeIdentityKeyById(id: string): Promise<void>;
export function removeAllIdentityKeys(): Promise<void>;

// Pre Keys
export function createOrUpdatePreKey(data: PreKey): Promise<void>;
export function getPreKeyById(id: number): Promise<PreKey | null>;
export function getPreKeyByRecipient(recipient: string): Promise<PreKey | null>;
export function bulkAddPreKeys(data: Array<PreKey>): Promise<void>;
export function removePreKeyById(id: number): Promise<void>;
export function getAllPreKeys(): Promise<Array<PreKey>>;

// Signed Pre Keys
export function createOrUpdateSignedPreKey(data: SignedPreKey): Promise<void>;
export function getSignedPreKeyById(id: number): Promise<SignedPreKey | null>;
export function getAllSignedPreKeys(): Promise<SignedPreKey | null>;
export function bulkAddSignedPreKeys(array: Array<SignedPreKey>): Promise<void>;
export function removeSignedPreKeyById(id: number): Promise<void>;
export function removeAllSignedPreKeys(): Promise<void>;

// Contact Pre Key
export function createOrUpdateContactPreKey(data: ContactPreKey): Promise<void>;
export function getContactPreKeyById(id: number): Promise<ContactPreKey | null>;
export function getContactPreKeyByIdentityKey(
  key: string
): Promise<ContactPreKey | null>;
export function getContactPreKeys(
  keyId: number,
  identityKeyString: string
): Promise<Array<ContactPreKey>>;
export function getAllContactPreKeys(): Promise<Array<ContactPreKey>>;
export function bulkAddContactPreKeys(
  array: Array<ContactPreKey>
): Promise<void>;
export function removeContactPreKeyByIdentityKey(id: number): Promise<void>;
export function removeAllContactPreKeys(): Promise<void>;

// Contact Signed Pre Key
export function createOrUpdateContactSignedPreKey(
  data: ContactSignedPreKey
): Promise<void>;
export function getContactSignedPreKeyById(
  id: number
): Promise<ContactSignedPreKey | null>;
export function getContactSignedPreKeyByIdentityKey(
  key: string
): Promise<ContactSignedPreKey | null>;
export function getContactSignedPreKeys(
  keyId: number,
  identityKeyString: string
): Promise<Array<ContactSignedPreKey>>;
export function bulkAddContactSignedPreKeys(
  array: Array<ContactSignedPreKey>
): Promise<void>;
export function removeContactSignedPreKeyByIdentityKey(
  id: string
): Promise<void>;
export function removeAllContactSignedPreKeys(): Promise<void>;

// Guard Nodes
export function getGuardNodes(): Promise<Array<GuardNode>>;
export function updateGuardNodes(nodes: Array<string>): Promise<void>;

// Storage Items
export function createOrUpdateItem(data: StorageItem): Promise<void>;
export function getItemById(id: string): Promise<StorageItem | undefined>;
export function getAlItems(): Promise<Array<StorageItem>>;
export function bulkAddItems(array: Array<StorageItem>): Promise<void>;
export function removeItemById(id: string): Promise<void>;
export function removeAllItems(): Promise<void>;

// Sessions
export function createOrUpdateSession(data: SessionDataInfo): Promise<void>;
export function getAllSessions(): Promise<Array<SessionDataInfo>>;
export function getSessionById(id: string): Promise<SessionDataInfo>;
export function getSessionsByNumber(number: string): Promise<SessionDataInfo>;
export function bulkAddSessions(array: Array<SessionDataInfo>): Promise<void>;
export function removeSessionById(id: string): Promise<void>;
export function removeSessionsByNumber(number: string): Promise<void>;
export function removeAllSessions(): Promise<void>;

// Conversations
export function getConversationCount(): Promise<number>;
export function saveConversation(data: ConversationType): Promise<void>;
export function saveConversations(data: Array<ConversationType>): Promise<void>;
export function updateConversation(
  id: string,
  data: ConversationType,
  { Conversation }
): Promise<void>;
export function removeConversation(id: string, { Conversation }): Promise<void>;

export function getAllConversations({
  ConversationCollection,
}: {
  ConversationCollection: any;
}): Promise<ConversationCollection>;

export function getAllConversationIds(): Promise<Array<string>>;
export function getPublicConversationsByServer(
  server: string,
  { ConversationCollection }: { ConversationCollection: any }
): Promise<ConversationCollection>;
export function getPubkeysInPublicConversation(
  id: string
): Promise<Array<string>>;
export function savePublicServerToken(data: ServerToken): Promise<void>;
export function getPublicServerTokenByServerUrl(
  serverUrl: string
): Promise<string>;
export function getAllGroupsInvolvingId(
  id: string,
  { ConversationCollection }: { ConversationCollection: any }
): Promise<ConversationCollection>;

// Returns conversation row
// TODO: Make strict return types for search
export function searchConversations(query: string): Promise<any>;
export function searchMessages(query: string): Promise<any>;
export function searchMessagesInConversation(
  query: string,
  conversationId: string,
  { limit }?: { limit: any }
): Promise<any>;
export function saveMessage(
  data: Mesasge,
  { forceSave, Message }?: { forceSave?: any; Message?: any }
): Promise<string>;
export function cleanSeenMessages(): Promise<void>;
export function cleanLastHashes(): Promise<void>;
export function saveSeenMessageHash(data: {
  expiresAt: number;
  hash: string;
}): Promise<void>;

export function getSwarmNodesForPubkey(pubkey: string): Promise<Array<string>>;
export function updateSwarmNodesForPubkey(
  pubkey: string,
  snodeEdKeys: Array<string>
): Promise<void>;
// TODO: Strictly type the following
export function updateLastHash(data: any): Promise<any>;
export function saveSeenMessageHashes(data: any): Promise<any>;
export function saveLegacyMessage(data: any): Promise<any>;
export function saveMessages(
  arrayOfMessages: any,
  { forceSave }?: any
): Promise<any>;
export function removeMessage(id: string, { Message }?: any): Promise<any>;
export function getUnreadByConversation(
  conversationId: string,
  { MessageCollection }?: any
): Promise<any>;
export function getUnreadCountByConversation(
  conversationId: string
): Promise<any>;
export function removeAllMessagesInConversation(
  conversationId: string,
  { MessageCollection }?: any
): Promise<void>;

export function getMessageBySender(
  {
    source,
    sourceDevice,
    sent_at,
  }: { source: any; sourceDevice: any; sent_at: any },
  { Message }: { Message: any }
): Promise<any>;
export function getMessagesBySender(
  { source, sourceDevice }: { source: any; sourceDevice: any },
  { Message }: { Message: any }
): Promise<MessageCollection>;
export function getMessageIdsFromServerIds(
  serverIds: any,
  conversationId: any
): Promise<any>;
export function getMessageById(
  id: string,
  { Message }: { Message: any }
): Promise<any>;
export function getAllMessages({
  MessageCollection,
}: {
  MessageCollection: any;
}): Promise<any>;
export function getAllUnsentMessages({
  MessageCollection,
}: {
  MessageCollection: any;
}): Promise<any>;
export function getAllMessageIds(): Promise<any>;
export function getMessagesBySentAt(
  sentAt: any,
  { MessageCollection }: { MessageCollection: any }
): Promise<any>;
export function getExpiredMessages({
  MessageCollection,
}: {
  MessageCollection: any;
}): Promise<any>;
export function getOutgoingWithoutExpiresAt({
  MessageCollection,
}: any): Promise<any>;
export function getNextExpiringMessage({
  MessageCollection,
}: {
  MessageCollection: any;
}): Promise<any>;
export function getNextExpiringMessage({
  MessageCollection,
}: {
  MessageCollection: any;
}): Promise<any>;
export function getMessagesByConversation(
  conversationId: any,
  {
    limit,
    receivedAt,
    MessageCollection,
    type,
  }: {
    limit?: number;
    receivedAt?: number;
    MessageCollection: any;
    type?: string;
  }
): Promise<any>;

export function getSeenMessagesByHashList(hashes: any): Promise<any>;
export function getLastHashBySnode(convoId: any, snode: any): Promise<any>;

// Unprocessed
export function getUnprocessedCount(): Promise<any>;
export function getAllUnprocessed(): Promise<any>;
export function getUnprocessedById(id: any): Promise<any>;
export function saveUnprocessed(
  data: any,
  {
    forceSave,
  }?: {
    forceSave: any;
  }
): Promise<any>;
export function saveUnprocesseds(
  arrayOfUnprocessed: any,
  {
    forceSave,
  }?: {
    forceSave: any;
  }
): Promise<void>;
export function updateUnprocessedAttempts(
  id: any,
  attempts: any
): Promise<void>;
export function updateUnprocessedWithData(id: any, data: any): Promise<void>;
export function removeUnprocessed(id: any): Promise<void>;
export function removeAllUnprocessed(): Promise<void>;

// Attachment Downloads
export function getNextAttachmentDownloadJobs(limit: any): Promise<any>;
export function saveAttachmentDownloadJob(job: any): Promise<void>;
export function setAttachmentDownloadJobPending(
  id: any,
  pending: any
): Promise<void>;
export function resetAttachmentDownloadPending(): Promise<void>;
export function removeAttachmentDownloadJob(id: any): Promise<void>;
export function removeAllAttachmentDownloadJobs(): Promise<void>;

// Other
export function removeAll(): Promise<void>;
export function removeAllConfiguration(): Promise<void>;
export function removeAllConversations(): Promise<void>;
export function removeAllPrivateConversations(): Promise<void>;
export function removeOtherData(): Promise<void>;
export function cleanupOrphanedAttachments(): Promise<void>;

// Getters
export function getMessagesNeedingUpgrade(
  limit: any,
  {
    maxVersion,
  }: {
    maxVersion?: number;
  }
): Promise<any>;
export function getLegacyMessagesNeedingUpgrade(
  limit: any,
  {
    maxVersion,
  }: {
    maxVersion?: number;
  }
): Promise<any>;
export function getMessagesWithVisualMediaAttachments(
  conversationId: any,
  {
    limit,
  }: {
    limit: any;
  }
): Promise<any>;
export function getMessagesWithFileAttachments(
  conversationId: any,
  {
    limit,
  }: {
    limit: any;
  }
): Promise<any>;

// Sender Keys
export function removeAllClosedGroupRatchets(groupId: string): Promise<void>;

export function getAllEncryptionKeyPairsForGroup(
  groupPublicKey: string | PubKey
): Promise<Array<HexKeyPair> | undefined>;
export function isKeyPairAlreadySaved(
  groupPublicKey: string,
  keypair: HexKeyPair
): Promise<boolean>;
export function getLatestClosedGroupEncryptionKeyPair(
  groupPublicKey: string
): Promise<HexKeyPair | undefined>;
export function addClosedGroupEncryptionKeyPair(
  groupPublicKey: string,
  keypair: HexKeyPair
): Promise<void>;
export function removeAllClosedGroupEncryptionKeyPairs(
  groupPublicKey: string
): Promise<void>;
