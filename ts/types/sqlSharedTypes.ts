export type MsgDuplicateSearchOpenGroup = Array<{
  sender: string;
  serverTimestamp: number;
}>;

export type UpdateLastHashType = {
  convoId: string;
  snode: string;
  hash: string;
  expiresAt: number;
  namespace: number;
};
