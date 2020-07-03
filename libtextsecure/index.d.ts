import { LibTextsecureCryptoInterface } from './crypto';

export interface LibTextsecure {
  crypto: LibTextsecureCryptoInterface;
  storage: any;
  SendMessageNetworkError: any;
  IncomingIdentityKeyError: any;
  OutgoingIdentityKeyError: any;
  ReplayableError: any;
  OutgoingMessageError: any;
  MessageError: any;
  SignedPreKeyRotationError: any;
  PoWError: any;
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
  SenderKeyMissing: any;
  createTaskWithTimeout(task: any, id: any, options?: any): Promise<any>;
}
