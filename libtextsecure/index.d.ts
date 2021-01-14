import { LibTextsecureCryptoInterface } from './crypto';

export interface LibTextsecure {
  messaging: any;
  crypto: LibTextsecureCryptoInterface;
  storage: any;
  SendMessageNetworkError: any;
  IncomingIdentityKeyError: any;
  OutgoingIdentityKeyError: any;
  ReplayableError: any;
  MessageError: any;
  SignedPreKeyRotationError: any;
  EmptySwarmError: any;
  SeedNodeError: any;
  DNSResolutionError: any;
  HTTPError: any;
  NotFoundError: any;
  WrongSwarmError: any;
  WrongDifficultyError: any;
  TimestampError: any;
  PublicChatError: any;
  PublicTokenError: any;
  createTaskWithTimeout(task: any, id: any, options?: any): Promise<any>;
}
