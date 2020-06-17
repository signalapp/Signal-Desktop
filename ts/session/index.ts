import * as Messages from './messages';
import * as Protocols from './protocols';
import * as Types from './types';
import { MessageQueue } from './sending';

const messageQueue = new MessageQueue();

export { Messages, Protocols, Types, messageQueue };
