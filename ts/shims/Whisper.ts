export function getMessageModel(attributes: any) {
  // @ts-ignore
  return new window.Whisper.Message(attributes);
}
