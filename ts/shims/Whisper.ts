export function getSearchResultsProps(attributes: any) {
  // @ts-ignore
  const model = new window.Whisper.Message(attributes);

  return model.getPropsForSearchResult();
}

export function getBubbleProps(attributes: any) {
  // @ts-ignore
  const model = new window.Whisper.Message(attributes);

  return model.getPropsForBubble();
}

export function isVoiceFlag(flags: any): boolean {
  // @ts-ignore
  const protoFlags = window.textsecure.protobuf.AttachmentPointer.Flags;
  const VOICE_MESSAGE_FLAG = protoFlags.VOICE_MESSAGE;

  // tslint:disable-next-line no-bitwise
  return Boolean(flags && flags & VOICE_MESSAGE_FLAG);
}
