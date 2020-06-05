import { EncryptionType } from './EncryptionType';

// TODO: Should we store failure count on raw messages??
// Might be better to have a seperate interface which takes in a raw message aswell as a failure count
export interface RawMessage {
  identifier: string;
  plainTextBuffer: Uint8Array;
  timestamp: number;
  device: string;
  ttl: number;
  encryption: EncryptionType;
}
