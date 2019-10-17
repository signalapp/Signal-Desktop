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

export function showSettings() {
  // @ts-ignore
  window.showSettings();
}
