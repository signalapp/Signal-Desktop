import { LibTextsecureCryptoInterface } from './crypto';

export interface LibTextsecure {
  messaging: boolean;
  crypto: LibTextsecureCryptoInterface;
  storage: any;
  SendMessageNetworkError: any;
  ReplayableError: any;
  EmptySwarmError: any;
  SeedNodeError: any;
  HTTPError: any;
  NotFoundError: any;
  TimestampError: any;
  PublicChatError: any;
  createTaskWithTimeout(task: any, id: any, options?: any): Promise<any>;
}
