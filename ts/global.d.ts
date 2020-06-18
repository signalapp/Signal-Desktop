interface Promise<T> {
  ignore(): void;
}

// Types also correspond to messages.json keys
enum LnsLookupErrorType {
  lnsTooFewNodes,
  lnsLookupTimeout,
  lnsMappingNotFound,
}
