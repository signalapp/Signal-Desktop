import { SignalService } from '../protobuf';

export interface Quote {
  id: any;
  author: any;
  attachments: Array<any>;
  text: string;
  referencedMessageNotFound: boolean;
}

export interface EnvelopePlus extends SignalService.Envelope {
  senderIdentity: string; // Sender's pubkey after it's been decrypted (for medium groups)
  receivedAt: number; // We only seem to set this for public messages?
  id: string;
}
