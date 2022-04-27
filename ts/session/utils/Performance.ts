export function perfStart(prefix: string) {
  // tslint:disable-next-line: no-typeof-undefined
  if (typeof performance !== 'undefined') {
    performance?.mark?.(`${prefix}-start`);
  }
}

export function perfEnd(prefix: string, measureName: string) {
  // tslint:disable-next-line: no-typeof-undefined
  if (typeof performance !== 'undefined') {
    performance?.mark?.(`${prefix}-end`);
    performance?.measure?.(measureName, `${prefix}-start`, `${prefix}-end`);
  }
}
