// This is inspired by the `is-path-inside` module on npm.
import * as path from 'path';

export function isPathInside(childPath: string, parentPath: string): boolean {
  const childPathResolved = path.resolve(childPath);

  let parentPathResolved = path.resolve(parentPath);
  if (!parentPathResolved.endsWith(path.sep)) {
    parentPathResolved += path.sep;
  }

  return (
    childPathResolved !== parentPathResolved &&
    childPathResolved.startsWith(parentPathResolved)
  );
}
