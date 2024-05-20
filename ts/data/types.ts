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
}

export type SwarmNode = Snode & {
  address: string;
};
