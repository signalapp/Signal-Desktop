

export interface MessageFetchType {
    messages: Array<any>,
    messageFetchTimestamp: number,
    newTopMessage: any,
    previousTopMessage: any,
}

export async function getMessages(
    conversationKey: string,
    currentMessages: Array<any>,
    messageFetchTimestamp: number,
    unreadCount: number,
    onGotMessages?: any,
    numMessages?: number,
    fetchInterval = window.CONSTANTS.MESSAGE_FETCH_INTERVAL,
    loopback = false,
    ){

    const timestamp = getTimestamp();

    // If we have pulled messages in the last interval, don't bother rescanning
    // This avoids getting messages on every re-render.
    const timeBuffer = timestamp - messageFetchTimestamp;
    if (timeBuffer < fetchInterval) {
      // Loopback gets messages after time has elapsed,
      // rather than completely cancelling the fetch.
      // if (loopback) {
      //   setTimeout(() => {
      //     this.getMessages(numMessages, fetchInterval, false);
      //   }, timeBuffer * 1000);
      // }      

      return { newTopMessage: undefined, previousTopMessage: undefined };
    }

    let msgCount = numMessages || window.CONSTANTS.DEFAULT_MESSAGE_FETCH_COUNT + unreadCount;
    msgCount = msgCount > window.CONSTANTS.MAX_MESSAGE_FETCH_COUNT
      ? window.CONSTANTS.MAX_MESSAGE_FETCH_COUNT
      : msgCount;

    const messageSet = await window.Signal.Data.getMessagesByConversation(
      conversationKey,
      { limit: msgCount, MessageCollection: window.Whisper.MessageCollection },
    );

    // Set first member of series here.
    const messageModels = messageSet.models;
    const messages = [];
    let previousSender;
    for (let i = 0; i < messageModels.length; i++){
      // Handle firstMessageOfSeries for conditional avatar rendering
      let firstMessageOfSeries = true;
      if (i > 0 && previousSender === messageModels[i].authorPhoneNumber){
        firstMessageOfSeries = false;
      }

      messages.push({...messageModels[i], firstMessageOfSeries});
      previousSender = messageModels[i].authorPhoneNumber;
    }

    const previousTopMessage = currentMessages[0]?.id;
    const newTopMessage = messages[0]?.id;

    messageFetchTimestamp = getTimestamp();

    // Callback to onGotMessages
    if (onGotMessages) onGotMessages(
        messages,
        messageFetchTimestamp,
        previousTopMessage,
        newTopMessage,
    );

    return { newTopMessage, previousTopMessage };
  }

export function getTimestamp(asInt = false){
    const timestamp = Date.now() / 1000;
    return asInt ? Math.floor(timestamp) : timestamp;
}