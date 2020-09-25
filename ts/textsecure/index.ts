import EventTarget from './EventTarget';
import AccountManager from './AccountManager';
import MessageReceiver from './MessageReceiver';
import utils from './Helpers';
import Crypto from './Crypto';
import { ContactBuffer, GroupBuffer } from './ContactsParser';
import createTaskWithTimeout from './TaskWithTimeout';
import SyncRequest from './SyncRequest';
import MessageSender from './SendMessage';
import StringView from './StringView';
import Storage from './Storage';
import * as WebAPI from './WebAPI';
import WebSocketResource from './WebsocketResources';

export const textsecure = {
  createTaskWithTimeout,
  crypto: Crypto,
  utils,
  storage: Storage,

  AccountManager,
  ContactBuffer,
  EventTarget,
  GroupBuffer,
  MessageReceiver,
  MessageSender,
  SyncRequest,
  StringView,
  WebAPI,
  WebSocketResource,
};

export default textsecure;
