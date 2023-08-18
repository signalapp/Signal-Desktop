export function perfStart(prefix: string) {
  if (typeof performance !== 'undefined') {
    performance?.mark?.(`${prefix}-start`);
  }
}

export function perfEnd(prefix: string, measureName: string) {
  if (typeof performance !== 'undefined') {
    performance?.mark?.(`${prefix}-end`);
    performance?.measure?.(measureName, `${prefix}-start`, `${prefix}-end`);
  }
}
