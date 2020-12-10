import { EncryptionType } from './EncryptionType';

// TODO: Should we store failure count on raw messages??
// Might be better to have a seperate interface which takes in a raw message aswell as a failure count
export type RawMessage = {
  identifier: string;
  plainTextBuffer: Uint8Array;
  timestamp: number;
  device: string;
  ttl: number;
  encryption: EncryptionType;
};

// For building RawMessages from JSON
export interface PartialRawMessage {
  identifier: string;
  plainTextBuffer: any;
  timestamp: number;
  device: string;
  ttl: number;
  encryption: number;
}
