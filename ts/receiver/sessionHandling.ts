export async function handleEndSession(number: string): Promise<void> {
  window.log.info('got end session');

  const { ConversationController } = window;

  try {
    const conversation = ConversationController.get(number);
    if (conversation) {
      await conversation.onSessionResetReceived();
    } else {
      throw new Error();
    }
  } catch (e) {
    window.log.error('Error getting conversation: ', number);
  }
}
