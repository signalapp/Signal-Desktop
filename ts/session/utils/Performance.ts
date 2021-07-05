export function perfStart(prefix: string) {
  performance.mark(`${prefix}-start`);
}

export function perfEnd(prefix: string, measureName: string) {
  performance.mark(`${prefix}-end`);
  performance.measure(measureName, `${prefix}-start`, `${prefix}-end`);
}
