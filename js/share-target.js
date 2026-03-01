// share-target.js — utilities for reading and clearing the share-target cache.
// Called by app.js when the app opens with ?shared=1.

const SHARE_CACHE_NAME = 'share-target-cache';
const SHARED_IMAGE_KEY = 'shared-image';

/**
 * Reads the image stored by the service worker from the share-target cache.
 * Returns an object URL string, or null if nothing is stored.
 */
async function getSharedImageUrl() {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(SHARE_CACHE_NAME);
    const response = await cache.match(SHARED_IMAGE_KEY);
    if (!response) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('share-target: failed to read cached image', err);
    return null;
  }
}

/**
 * Removes the stored image from the share-target cache.
 * Call after the image has been processed or discarded.
 */
async function clearSharedImage() {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(SHARE_CACHE_NAME);
    await cache.delete(SHARED_IMAGE_KEY);
  } catch (err) {
    console.error('share-target: failed to clear cached image', err);
  }
}
