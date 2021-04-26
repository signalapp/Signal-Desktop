import { EncryptionType } from './EncryptionType';

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
