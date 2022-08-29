export type MsgDuplicateSearchOpenGroup = Array<{
  sender: string;
  serverTimestamp: number;
  // senderBlinded?: string; // for a message we sent, we need a blinded id and an unblinded one
}>;

export type UpdateLastHashType = {
  convoId: string;
  snode: string;
  hash: string;
  expiresAt: number;
  namespace: number;
};
