import { SignalService } from '../../protobuf';
import { SnodeNamespaces } from '../apis/snode_api/namespaces';

export type RawMessage = {
  identifier: string;
  plainTextBuffer: Uint8Array;
  device: string;
  ttl: number; // ttl is in millis
  encryption: SignalService.Envelope.Type;
  namespace: SnodeNamespaces | null; // allowing null as when we upgrade, we might have messages awaiting sending which won't have a namespace
};

// For building RawMessages from JSON
export interface PartialRawMessage {
  identifier: string;
  plainTextBuffer: any;
  device: string;
  ttl: number;
  encryption: number;
}
