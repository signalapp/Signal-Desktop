import { SignalService } from '../../protobuf';

export type RawMessage = {
  identifier: string;
  plainTextBuffer: Uint8Array;
  device: string;
  ttl: number;
  encryption: SignalService.Envelope.Type;
};

// For building RawMessages from JSON
export interface PartialRawMessage {
  identifier: string;
  plainTextBuffer: any;
  device: string;
  ttl: number;
  encryption: number;
}
