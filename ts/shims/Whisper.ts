// Matching Whisper.Message API
// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function getSearchResultsProps(attributes: any): any {
  const model = new window.Whisper.Message(attributes);

  return model.getPropsForSearchResult();
}

// Matching Whisper.Message API
// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function getBubbleProps(attributes: any): any {
  const model = new window.Whisper.Message(attributes);

  return model.getPropsForBubble();
}

export function showSettings(): void {
  window.showSettings();
}
