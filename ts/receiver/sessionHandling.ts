export async function handleEndSession(number: string): Promise<void> {
  window.log.info('got end session');

  const { ConversationController } = window;

  try {
    const conversation = ConversationController.get(number);
    if (conversation) {
      // this just marks the conversation as being waiting for a new session
      // it does trigger a message to be sent. (the message is sent from handleSessionRequestMessage())
      await conversation.onSessionResetReceived();
    } else {
      throw new Error();
    }
  } catch (e) {
    window.log.error('Error getting conversation: ', number);
  }
}
