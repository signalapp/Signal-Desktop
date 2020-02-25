export function searchMessages(query: string): Promise<Array<any>>;
export function searchConversations(query: string): Promise<Array<any>>;
export function getPrimaryDeviceFor(pubKey: string): Promise<string | null>;

export function getMessagesByConversation(conversationId: string, destructurer: any): Promise<Array<any>>;
