import { Data } from '../data/data';

// TODO update to agreed value between platforms
const featureReleaseTimestamp = 1677574800000; // unix 28/02/2023 09:00
// const featureReleaseTimestamp = 1676608378; // test value
let isFeatureReleased: boolean | undefined;

/**
 * this is only intended for testing. Do not call this in production.
 */
export function resetFeatureReleasedCachedValue() {
  isFeatureReleased = undefined;
}

export async function getIsFeatureReleased(): Promise<boolean> {
  if (isFeatureReleased === undefined) {
    // read values from db and cache them as it looks like we did not
    const oldIsFeatureReleased = (await Data.getItemById('featureReleased'))?.value;
    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldIsFeatureReleased === undefined) {
      await Data.createOrUpdateItem({ id: 'featureReleased', value: false });
      isFeatureReleased = false;
    } else {
      isFeatureReleased = oldIsFeatureReleased;
    }
  }
  return Boolean(isFeatureReleased);
}

export async function checkIsFeatureReleased(featureName: string): Promise<boolean> {
  if (isFeatureReleased === undefined) {
    const featureAlreadyReleased = await getIsFeatureReleased();

    // Is it time to release the feature?
    if (Date.now() >= featureReleaseTimestamp) {
      if (featureAlreadyReleased) {
        // Feature is already released and we don't need to update the db
        window.log.info(`WIP: [releaseFeature]: ${featureName} is released`);
      } else {
        window.log.info(
          `WIP: [releaseFeature]: It is time to release ${featureName}. Releasing it now`
        );
        await Data.createOrUpdateItem({
          id: 'featureReleased',
          value: true,
        });
      }
      return true;
    }
  }

  window.log.info(`WIP: [releaseFeature]: ${featureName} has not been released yet`);
  return false;
}
