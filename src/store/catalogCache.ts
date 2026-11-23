import {storage} from './mmkv';
import {debugFactory} from '../utils/debug';

const log = debugFactory('catalogCache');

// On-device cache for the merged cloud catalog, OneCast-style: the Cloud
// screen renders instantly from this copy on open (with the true section
// counts) and only downloads a fresh catalog in the background when the
// copy is stale or the signed-in token changed. Without it, every app
// open re-downloaded ~2,800 titles and rebuilt the page chunk by chunk.
const TITLES_KEY = 'catalog.titles.v1';
const META_KEY = 'catalog.meta.v1';

// A cached catalog is trusted without any network for this long.
export const CATALOG_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export type CatalogSections = {
  popular: string[];
  leaving: string[];
  mkb: string[];
  touch: string[];
  newIds: string[];
  recentIds: string[];
};

export type CatalogCache = {
  savedAt: number;
  titles: any[];
  sections: CatalogSections;
  // The account that fetched this catalog (user hash from the web
  // token), or null for caches written before owner tracking existed.
  // The entitlement flags belong to that account alone.
  owner: string | null;
};

// Only the fields the Cloud screen, TitleItem and TitleDetail actually
// read are kept, which holds the cache to roughly a megabyte. `details`
// is kept whole: the badge logic (programs / hasEntitlement /
// isFreeInStore) lives on it.
const projectTitle = (item: any) => ({
  productId: item.productId,
  ProductTitle: item.ProductTitle,
  PublisherName: item.PublisherName,
  Image_Tile: item.Image_Tile ? {URL: item.Image_Tile.URL} : item.Image_Tile,
  Image_Poster: item.Image_Poster
    ? {URL: item.Image_Poster.URL}
    : item.Image_Poster,
  Categories: item.Categories,
  XCloudTitleId: item.XCloudTitleId,
  titleId: item.titleId,
  details: item.details,
});

export const emptySections = (): CatalogSections => ({
  popular: [],
  leaving: [],
  mkb: [],
  touch: [],
  newIds: [],
  recentIds: [],
});

export const saveCatalogCache = (
  titles: any[],
  sections: CatalogSections,
  owner: string | null = null,
): void => {
  try {
    // Never let an empty result replace a good cached catalog: the
    // read side refuses to load an empty titles array, so writing one
    // would only destroy the previous copy. Entries are validated the
    // same way the read side validates them: an entry without a
    // string productId would invalidate the whole cache on next
    // load, so such entries are dropped here instead of written.
    const validTitles = (Array.isArray(titles) ? titles : []).filter(
      item =>
        item &&
        typeof item === 'object' &&
        typeof item.productId === 'string',
    );
    if (validTitles.length === 0) {
      return;
    }
    // Build both payloads first, then write the meta LAST: the meta
    // is the commit point. Titles are written first, so an
    // interruption mid-save pairs the NEW titles with the PREVIOUS
    // meta — the stale savedAt forces a refetch and the stale
    // sections/owner are validated defensively on load, so that
    // pairing is safe. The reverse order would be the dangerous one:
    // a fresh meta (fresh timestamp, new owner) paired with old
    // titles would present a stale catalog as fresh.
    const titlesJson = JSON.stringify(validTitles.map(projectTitle));
    const metaJson = JSON.stringify({
      savedAt: Date.now(),
      sections,
      owner: typeof owner === 'string' ? owner : null,
    });
    storage.set(TITLES_KEY, titlesJson);
    storage.set(META_KEY, metaJson);
  } catch (e) {
    log.info('saveCatalogCache failed:', (e && e.message) || e);
  }
};

// The cached flags (hasEntitlement etc.) belong to the account that
// fetched them, so the cache is dropped on logout: a different account
// signing in afterwards must never see the previous account's library.
export const clearCatalogCache = (): void => {
  try {
    storage.delete(TITLES_KEY);
    storage.delete(META_KEY);
  } catch (e) {
    log.info('clearCatalogCache failed:', (e && e.message) || e);
  }
};

export const loadCatalogCache = (): CatalogCache | null => {
  try {
    const titlesRaw = storage.getString(TITLES_KEY);
    const metaRaw = storage.getString(META_KEY);
    if (!titlesRaw || !metaRaw) {
      return null;
    }
    const titles = JSON.parse(titlesRaw);
    const meta = JSON.parse(metaRaw);
    if (!Array.isArray(titles) || titles.length === 0) {
      return null;
    }
    // Every entry must be a title-shaped object: the Cloud screen
    // dereferences item.productId while building its map, so a single
    // malformed entry must invalidate the whole cache rather than
    // crash the screen.
    if (
      !titles.every(
        item =>
          item &&
          typeof item === 'object' &&
          typeof item.productId === 'string',
      )
    ) {
      return null;
    }
    if (!meta || typeof meta.savedAt !== 'number' || !meta.sections) {
      return null;
    }
    // Validate each section field's TYPE, not just its presence: a
    // stored field of the wrong type would throw in the Cloud screen's
    // byIds mapping. A bad field degrades to an empty list instead of
    // invalidating the whole cache.
    const sections = emptySections();
    (Object.keys(sections) as (keyof CatalogSections)[]).forEach(key => {
      if (Array.isArray(meta.sections[key])) {
        sections[key] = meta.sections[key];
      }
    });
    return {
      savedAt: meta.savedAt,
      titles,
      sections,
      owner: typeof meta.owner === 'string' ? meta.owner : null,
    };
  } catch (e) {
    log.info('loadCatalogCache failed:', (e && e.message) || e);
    return null;
  }
};
