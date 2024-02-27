function envAppInstanceIncludes(prefix: string) {
  if (!process.env.NODE_APP_INSTANCE) {
    return false;
  }
  return !!process.env.NODE_APP_INSTANCE.includes(prefix);
}

export function isDevProd() {
  return envAppInstanceIncludes('devprod');
}
export function isTestNet() {
  return envAppInstanceIncludes('testnet');
}
export function isTestIntegration() {
  return envAppInstanceIncludes('test-integration');
}
