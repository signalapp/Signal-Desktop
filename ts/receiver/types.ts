import { SignalService } from '../protobuf';

export interface Quote {
  id: number; // this is in fact a uint64 so we will have an issue
  author: string;
  attachments: Array<any> | null;
  text: string | null;
  referencedMessageNotFound: boolean;
}

export interface EnvelopePlus extends Omit<SignalService.Envelope, 'toJSON'> {
  senderIdentity: string; // Sender's pubkey after it's been decrypted (for medium groups)
  receivedAt: number; // We only seem to set this for public messages?
  id: string;
}
