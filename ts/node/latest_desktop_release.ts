let latestRelease: string | undefined;

export function setLastestRelease(release: string) {
  latestRelease = release;
}

export function getLastestRelease() {
  return latestRelease;
}
