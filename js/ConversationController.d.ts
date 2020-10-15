import { ConversationModel } from "./models/conversations";

export type ConversationControllerType = {
    reset: () => void;
    load: () => Promise<void>;
    get: (id: string) => ConversationModel | undefined;
    getOrCreateAndWait: (id: string, type: string) => Promise<ConversationModel>; getOrCreate: (id: string, type: string) => Promise<ConversationModel>;

}