import { SnodeNamespaces } from './namespaces';

export type RetrieveMessageItem = {
  hash: string;
  expiration: number;
  data: string; // base64 encrypted content of the emssage
  timestamp: number;
};

export type RetrieveMessagesResultsContent = {
  hf?: Array<number>;
  messages?: Array<RetrieveMessageItem>;
  more: boolean;
  t: number;
};

export type RetrieveRequestResult = {
  code: number;
  messages: RetrieveMessagesResultsContent;
  namespace: SnodeNamespaces;
};

export type RetrieveMessagesResultsBatched = Array<RetrieveRequestResult>;
