import { LibTextsecureCryptoInterface } from './crypto';

export interface LibTextsecure {
  messaging: boolean;
  crypto: LibTextsecureCryptoInterface;
  storage: any;
  SendMessageNetworkError: any;
  ReplayableError: any;
  EmptySwarmError: any;
  HTTPError: any;
  NotFoundError: any;
  TimestampError: any;
}
