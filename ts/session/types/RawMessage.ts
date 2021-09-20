import { EncryptionType } from './EncryptionType';

export type RawMessage = {
  identifier: string;
  plainTextBuffer: Uint8Array;
  device: string;
  ttl: number;
  encryption: EncryptionType;
};

// For building RawMessages from JSON
export interface PartialRawMessage {
  identifier: string;
  plainTextBuffer: any;
  device: string;
  ttl: number;
  encryption: number;
}
