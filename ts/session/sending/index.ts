// TS 3.8 supports export * as X from 'Y'
import * as MessageSender from './MessageSender';
import * as LokiMessageApi from './LokiMessageApi';
export { MessageSender, LokiMessageApi };

export * from './PendingMessageCache';
export * from './MessageQueue';
