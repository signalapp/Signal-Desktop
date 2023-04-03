import { Data } from '../data/data';

// TODO update to agreed value between platforms
const featureReleaseTimestamp = 1706778000000; // unix 01/02/2024 09:00
// const featureReleaseTimestamp = 1677488400000; // unix 27/02/2023 09:00
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
      } else {
        window.log.info(
          `WIP: [releaseFeature]: It is time to release ${featureName}. Releasing it now`
        );
        await Data.createOrUpdateItem({
          id: 'featureReleased',
          value: true,
        });
      }
      isFeatureReleased = true;
    } else {
      // Reset featureReleased to false if we have already released a feature since we have updated the featureReleaseTimestamp to a later date.
      // The alternative solution would be to do a db migration everytime we want to use this system.
      if (featureAlreadyReleased) {
        await Data.createOrUpdateItem({
          id: 'featureReleased',
          value: false,
        });
        isFeatureReleased = false;
      }
    }
  }

  window.log.info(
    `WIP: [releaseFeature]: ${featureName} ${
      Boolean(isFeatureReleased) ? 'is released' : 'has not been released yet'
    }`
  );
  return Boolean(isFeatureReleased);
}
