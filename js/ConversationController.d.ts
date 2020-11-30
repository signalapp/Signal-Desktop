import { ConversationModel } from './models/conversations';

export type ConversationControllerType = {
  reset: () => void;
  load: () => Promise<void>;
  get: (id: string) => ConversationModel | undefined;
  getOrThrow: (id: string) => ConversationModel;
  getOrCreateAndWait: (id: string, type: string) => Promise<ConversationModel>;
  getOrCreate: (id: string, type: string) => Promise<ConversationModel>;
  dangerouslyCreateAndAdd: (any) => any;
  getContactProfileNameOrShortenedPubKey: (id: string) => string;
  getContactProfileNameOrFullPubKey: (id: string) => string;
};
