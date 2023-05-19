import { FEATURE_RELEASE_TIMESTAMPS } from '../session/constants';
import { Storage } from './storage';

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
    const oldIsFeatureReleased = Boolean(Storage.get('featureReleased'));
    // values do not exist in the db yet. Let's store false for now in the db and update our cached value.
    if (oldIsFeatureReleased === undefined) {
      await Storage.put('featureReleased', false);
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
    if (Date.now() >= FEATURE_RELEASE_TIMESTAMPS[`${featureName}`]) {
      if (featureAlreadyReleased) {
        // Feature is already released and we don't need to update the db
      } else {
        window.log.info(`[releaseFeature]: It is time to release ${featureName}. Releasing it now`);
        await Storage.put('featureReleased', true);
      }
      isFeatureReleased = true;
    } else {
      // Reset featureReleased to false if we have already released a feature since we have updated the featureReleaseTimestamp to a later date.
      // The alternative solution would be to do a db migration everytime we want to use this system.
      if (featureAlreadyReleased) {
        await Storage.put('featureReleased', false);
        isFeatureReleased = false;
      }
    }
  }

  window.log.info(
    `[releaseFeature]: ${featureName} ${
      Boolean(isFeatureReleased) ? 'is released' : 'has not been released yet'
    }`
  );
  return Boolean(isFeatureReleased);
}
