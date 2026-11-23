import React from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import {Text, Appbar, FAB, Button, useTheme} from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import {useSelector} from 'react-redux';
import TitleItem, {getTitleBadge} from '../components/TitleItem';
import FastImage from 'react-native-fast-image';
import XcloudApi from '../xCloud';
import Empty from '../components/Empty';
import {
  loadCatalogCache,
  saveCatalogCache,
  emptySections,
  CATALOG_TTL_MS,
  projectTitle,
} from '../store/catalogCache';
import {debugFactory} from '../utils/debug';
import {getLastAuthError} from '../utils/authError';
import {useTranslation} from 'react-i18next';

const log = debugFactory('CloudScreen');

const SIGL_POPULAR = 'e7590b22-e299-44db-ae22-25c61405454c';
const SIGL_LEAVING = '393f05bf-e596-4ef6-9487-6d4fa0eab987';
const SIGL_MKB = '8fa264dd-124f-4af3-97e8-596fcdf4b486';
const SIGL_TOUCH = '9c86f07a-f3e8-45ad-82a0-a1f759597059';

// A stable per-account identity for the catalog cache, taken from the
// web token's claims (user hash, falling back to gamertag). The cached
// entitlement flags belong to one account; the cache records who
// fetched it so a different account is never served the previous
// account's library as its own.
const catalogOwnerOf = token => {
  try {
    // The token handed in is the XSTS web token: its claims sit at
    // data.DisplayClaims (the same place WebApi.getClaims reads).
    // Reading the Sisu shape (data.AuthorizationToken...) here made
    // this return null for every real token.
    const xui =
      token &&
      token.data &&
      token.data.DisplayClaims &&
      token.data.DisplayClaims.xui;
    return (xui && xui[0] && (xui[0].uhs || xui[0].gtg)) || null;
  } catch (e) {
    return null;
  }
};

function CloudScreen({navigation}) {
  const {t} = useTranslation();
  const theme = useTheme();
  const streamingTokens = useSelector(state => state.streamingTokens);
  const authentication = useSelector(state => state.authentication);
  const webToken = useSelector(state => state.webToken);

  const [current, setCurrent] = React.useState(3);
  const [numColumns, setNumColumns] = React.useState(2);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  // The streaming token is minted by the sign-in flow shortly after
  // the app starts. Until it arrives, "no token yet" must not be
  // shown as "no XGPU permission": the tab waits (spinner) and only
  // reports limited once a grace period has passed with no token.
  const [tokenWaitExpired, setTokenWaitExpired] = React.useState(false);

  // True once a COMPLETE catalog is on screen (from the cache or a
  // finished fetch). Section counts are only shown then: during a cold
  // progressive fill the counts would climb chunk by chunk and read as
  // final numbers long before they are true.
  const [hydrated, setHydrated] = React.useState(false);
  const [titles, setTitles] = React.useState([]);
  const [newTitles, setNewTitles] = React.useState([]);
  const [RecentTitles, setRecentNewTitles] = React.useState([]);
  const [orgTitles, setOrgTitles] = React.useState([]);
  const [keyword, setKeyword] = React.useState('');
  const flatListRef = React.useRef(null);
  const fetchInFlight = React.useRef(false);
  const cacheApplied = React.useRef(false);
  const cacheSavedAt = React.useRef(0);
  const lastFetchToken = React.useRef(null);
  const fetchGamesRef = React.useRef(null);
  const catalogRetryTimerRef = React.useRef(null);
  const catalogRetryCountRef = React.useRef(0);
  // The token whose fetch APPLIED the titles currently on screen (as
  // opposed to lastFetchToken, the last successfully stamped one):
  // if every refresh for the current token then fails, fail() uses
  // this to tell a foreign catalog it must drop from one of the
  // current account's it may leave up. Null when the screen's
  // provenance is unknown (a cache serve).
  const appliedTokenRef = React.useRef(null);
  // The account owner (from the web token) whose fetch applied the
  // titles, stamped alongside appliedTokenRef: the foreign-catalog
  // test compares owners when both are known, because a same-account
  // token re-mint replaces the token OBJECT and must not condemn
  // its own account's catalog.
  const appliedOwnerRef = React.useRef(null);
  // False only once the screen has unmounted: a superseded fetch
  // hands its refetch to the newest effect run, but must not start
  // work for a screen that no longer exists.
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Mirror of the current streaming token, readable inside async
  // fetch completions: a fetch that finishes after the token changed
  // (e.g. a different account signed in) must not apply or cache its
  // results — they belong to the previous token.
  const xCloudTokenRef = React.useRef(null);
  const webTokenRef = React.useRef(null);
  // The section ID lists behind the catalog currently on screen, kept
  // so a refresh whose curated requests partly fail can fall back to
  // the previous lists instead of wiping every section.
  const lastSectionsRef = React.useRef(emptySections());
  const [fabOpen, setFabOpen] = React.useState(false);
  const [view, setView] = React.useState('home');
  const [popularTitles, setPopularTitles] = React.useState([]);
  const [leavingTitles, setLeavingTitles] = React.useState([]);
  const [mkbTitles, setMkbTitles] = React.useState([]);
  const [touchTitles, setTouchTitles] = React.useState([]);
  const [customSection, setCustomSection] = React.useState(null);

  const xCloudToken = streamingTokens.xCloudToken;
  xCloudTokenRef.current = xCloudToken;
  webTokenRef.current = webToken;
  // Derived, not state: limited means the grace period passed and
  // there is STILL no streaming token.
  const isLimited = !xCloudToken && tokenWaitExpired;

  // Grace period for the token: while there is no streaming token,
  // count 10 seconds before the tab may call itself limited. If the
  // token arrives first, the wait resets. Each retry starts a fresh
  // wait cycle.
  const [waitCycle, setWaitCycle] = React.useState(0);
  React.useEffect(() => {
    if (xCloudToken) {
      setTokenWaitExpired(false);
      return undefined;
    }
    setTokenWaitExpired(false);
    const waitTimer = setTimeout(() => setTokenWaitExpired(true), 10000);
    return () => clearTimeout(waitTimer);
  }, [xCloudToken, waitCycle]);

  // Ask the shared sign-in flow to mint the streaming token again and
  // restart the grace wait. The flow is single-flight and resets
  // cleanly after a failure, so calling this repeatedly is safe. This
  // is what recovers the tab when the app was opened offline: nothing
  // else re-runs the sign-in when connectivity returns, so without it
  // the only cure was restarting the app.
  const doAuthCheck = React.useCallback(() => {
    if (authentication && authentication.checkAuthentication) {
      authentication.checkAuthentication().catch(() => {});
    }
  }, [authentication]);

  const retryAuth = React.useCallback(() => {
    setWaitCycle(c => c + 1);
    doAuthCheck();
  }, [doAuthCheck]);

  // Recover automatically the moment connectivity returns while the
  // tab is still tokenless. This deliberately does NOT restart the
  // grace wait (no waitCycle bump): repeated connectivity events
  // (Wi-Fi/VPN/interface changes) would otherwise keep pushing the
  // wait back and the Retry button might never appear.
  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected !== false && !xCloudToken) {
        doAuthCheck();
      }
    });
    return () => unsubscribe();
  }, [xCloudToken, doAuthCheck]);

  // Put a complete catalog (cached or freshly fetched) on screen: build
  // the product map, the owned-games list and every curated section from
  // the stored section ID lists.
  const applyCatalog = React.useCallback((allTitles, sections) => {
    lastSectionsRef.current = sections;
    // Only title-shaped entries may reach state: the genre memo, the
    // keyword filter and the grid key extractor all dereference the
    // raw list, so the malformed-entry skip must cover it too, not
    // just the map built below.
    const safeTitles = (allTitles || [])
      .filter(item => item && typeof item.productId === 'string')
      // Normalise through the cache projection: live fetch results
      // must get the same field-type guarantees as cached ones, or a
      // malformed API entry crashes the memos the projection exists
      // to protect.
      .map(projectTitle);
    const _titleMap = {};
    const _orgTitles = [];
    safeTitles.forEach(item => {
      // Skip anything that is not a title-shaped object: one malformed
      // entry must not crash the whole screen.
      if (!item || typeof item.productId !== 'string') {
        return;
      }
      _titleMap[item.productId] = item;
      if (
        !item.XCloudTitleId &&
        item.details &&
        Array.isArray(item.details.programs) &&
        item.details.programs.indexOf('BYOG') > -1
      ) {
        _orgTitles.push(item);
      }
    });
    const byIds = ids =>
      (ids || [])
        .map(id => _titleMap[id])
        .filter(item => !!item);
    const recentByIds = ids => {
      const mapped = [];
      (ids || []).forEach(id => {
        const hit =
          _titleMap[id] ||
          _titleMap[String(id).toUpperCase()] ||
          _titleMap[String(id).toLowerCase()];
        if (hit) {
          mapped.push(hit);
        }
      });
      return mapped;
    };
    setTitles(safeTitles);
    setOrgTitles(_orgTitles);
    setPopularTitles(byIds(sections.popular));
    setLeavingTitles(byIds(sections.leaving));
    setMkbTitles(byIds(sections.mkb));
    setTouchTitles(byIds(sections.touch));
    setNewTitles(byIds(sections.newIds));
    setRecentNewTitles(recentByIds(sections.recentIds));
    setHydrated(true);

    // Warm the on-phone image cache for the rows the home screen
    // shows, so their tile pictures are already on disk — and shown
    // instantly — on later opens, instead of downloading fresh while
    // the (already cached) names and badges are on screen.
    try {
      const seen = {};
      const preloadList = [];
      const pushUrls = list => {
        (list || []).slice(0, 10).forEach(item => {
          const url =
            item.Image_Tile && item.Image_Tile.URL
              ? 'https:' + item.Image_Tile.URL
              : '';
          if (url && !seen[url]) {
            seen[url] = true;
            preloadList.push({
              uri: url,
              cache: FastImage.cacheControl.immutable,
            });
          }
        });
      };
      pushUrls(recentByIds(sections.recentIds));
      // The "Included in your subscription" row is GP-only, so warm
      // exactly its first tiles — not a mix of every badged title.
      pushUrls(safeTitles.filter(item => getTitleBadge(item) === 'GP'));
      pushUrls(byIds(sections.popular));
      pushUrls(byIds(sections.newIds));
      pushUrls(byIds(sections.leaving));
      pushUrls(byIds(sections.mkb));
      pushUrls(byIds(sections.touch));
      pushUrls(_orgTitles);
      if (preloadList.length > 0) {
        FastImage.preload(preloadList);
      }
    } catch (e) {
      // Preloading is best-effort only; tiles still load on display.
    }
  }, []);

  // Whether the fetch-applied catalog on screen belongs to a
  // different account than the current one: by owner when both
  // owners are known, else by token identity. A cache serve is never
  // foreign (appliedTokenRef is null then).
  const fetchAppliedCatalogIsForeign = currentToken => {
    const applied = appliedTokenRef.current;
    if (!applied || applied === currentToken) {
      return false;
    }
    const appliedOwner = appliedOwnerRef.current;
    const currentOwner = catalogOwnerOf(webTokenRef.current);
    if (appliedOwner && currentOwner) {
      return appliedOwner !== currentOwner;
    }
    return true;
  };

  React.useEffect(() => {
    let cancelled = false;
    const handleFetchError = e => {
      log.error('Fetch games failed:', (e && e.message) || e);
      setLoading(false);
      Alert.alert(t('Error'), (e && e.message) || String(e));
    };

    // background=true: keep whatever is on screen, show no overlay and
    // report no alert — used for cache refreshes and pull-to-refresh,
    // where a failure must not blank a working screen.
    const fetchGames = background => {
      if (fetchInFlight.current) {
        setRefreshing(false);
        return;
      }
      if (!xCloudToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const region = xCloudToken.getDefaultRegion();
      if (!region) {
        fetchInFlight.current = false;
        setLoading(false);
        setRefreshing(false);
        if (!background) {
          handleFetchError(
            new Error(
              t('No streaming server is available yet. Please try again.'),
            ),
          );
        }
        return;
      }
      fetchInFlight.current = true;
      // lastFetchToken is deliberately NOT stamped here: it records
      // the last token whose catalog was successfully applied, so a
      // failed refresh leaves the token-change condition true and a
      // later effect run retries instead of waiting out the TTL.
      if (!background) {
        setLoading(true);
      }
      const _xCloudApi = new XcloudApi(
        region.baseUri,
        xCloudToken.data.gsToken,
        'cloud',
      );
      const finish = () => {
        fetchInFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      };
      const fail = e => {
        finish();
        // The token changed while this fetch ran and the fetch then
        // failed: the failure belongs to the previous token. Do not
        // alert for it in the new session — fetch afresh for the
        // current token instead. This check comes BEFORE the
        // cancelled check on purpose: a token change always cancels
        // this effect run, so checking cancelled first would make
        // this recovery unreachable exactly when it is needed.
        if (xCloudTokenRef.current !== xCloudToken) {
          if (mountedRef.current && fetchGamesRef.current) {
            fetchGamesRef.current(background);
          }
          return;
        }
        if (cancelled) {
          // Superseded by an effect re-run that was NOT a token
          // change (the token case is handled above): the new run
          // found the fetch latch held and skipped, so hand the fetch
          // to it — otherwise this failure is dropped and nothing
          // refetches until pull-to-refresh.
          if (mountedRef.current && fetchGamesRef.current) {
            fetchGamesRef.current(background);
          }
          return;
        }
        if (!background) {
          // A foreground failure leaves the error alert as the only
          // feedback, but a catalog a DIFFERENT token's fetch applied
          // must not stay up behind it: no effect run will retry, so
          // drop it here exactly as the background path does once its
          // retries are exhausted.
          if (fetchAppliedCatalogIsForeign(xCloudToken)) {
            appliedTokenRef.current = null;
            appliedOwnerRef.current = null;
            applyCatalog([], emptySections());
          }
          handleFetchError(e);
        } else {
          log.error('Background catalog refresh failed:', (e && e.message) || e);
          // The on-screen catalog is not the current token's (e.g.
          // the token changed and this refresh for it failed): no
          // effect run will retry on its own, so schedule a bounded
          // number of retries here instead of leaving the previous
          // account's catalog up indefinitely. Once the retries are
          // exhausted, drop a catalog a DIFFERENT token's fetch
          // applied just before the change — leaving another
          // account's games up forever is worse than an empty screen
          // the user can pull-to-refresh.
          if (
            lastFetchToken.current !== xCloudToken &&
            !catalogRetryTimerRef.current
          ) {
            if (catalogRetryCountRef.current < 3) {
              catalogRetryCountRef.current += 1;
              catalogRetryTimerRef.current = setTimeout(() => {
                catalogRetryTimerRef.current = null;
                if (fetchGamesRef.current) {
                  fetchGamesRef.current(true);
                }
              }, 5000);
            } else if (fetchAppliedCatalogIsForeign(xCloudToken)) {
              appliedTokenRef.current = null;
              appliedOwnerRef.current = null;
              applyCatalog([], emptySections());
            }
          }
        }
      };

      _xCloudApi
        .getTitles()
        .then(res => {
          if (!res.results) {
            // getTitles() resolves [] on failure, which has no .results:
            // treat it as an error instead of spinning forever.
            fail(
              new Error(
                t(
                  'Failed to load games. Please check your connection and try again.',
                ),
              ),
            );
            return;
          }
          // Fire the curated-list requests NOW, in parallel with the
          // catalog hydration below, instead of chaining them after it:
          // "Jump back in" used to arrive last of all.
          const idList = list =>
            (list || []).map(item => item && item.id).filter(id => !!id);
          // Each curated request fails INDEPENDENTLY (null slot): one
          // dead gallery must not wipe the other five sections.
          const auxOrNull = p =>
            p.catch(e => {
              log.error('Curated list failed:', (e && e.message) || e);
              return null;
            });
          const auxPromise = Promise.all([
            auxOrNull(_xCloudApi.getSiglTitles(SIGL_POPULAR).then(idList)),
            auxOrNull(_xCloudApi.getSiglTitles(SIGL_LEAVING).then(idList)),
            auxOrNull(_xCloudApi.getSiglTitles(SIGL_MKB).then(idList)),
            auxOrNull(_xCloudApi.getSiglTitles(SIGL_TOUCH).then(idList)),
            auxOrNull(_xCloudApi.getNewTitles().then(idList)),
            auxOrNull(
              _xCloudApi.getRecentTitles().then(recentRes => {
                const results = (recentRes && recentRes.results) || [];
                return results
                  .map(item => item.details && item.details.productId)
                  .filter(id => !!id);
              }),
            ),
          ]);

          _xCloudApi
            .getGamePassProducts(res.results, partialTitles => {
              // Progressive fill only matters on a true cold load; when a
              // cached catalog is already on screen it stays untouched
              // until the fresh one is complete. And if the token
              // changed mid-fetch, the partial data is not ours to show.
              if (
                !cancelled &&
                !cacheApplied.current &&
                xCloudTokenRef.current === xCloudToken
              ) {
                // Same malformed-entry filter applyCatalog applies:
                // the genre memo and keyword filter dereference the
                // raw list, so partial data needs it too.
                appliedTokenRef.current = xCloudToken;
                appliedOwnerRef.current =
                  catalogOwnerOf(webTokenRef.current);
                setTitles(
                  (partialTitles || [])
                    .filter(
                      item => item && typeof item.productId === 'string',
                    )
                    .map(projectTitle),
                );
              }
            })
            .then(async _titles => {
              // The token changed while this fetch ran (e.g. a
              // different account signed in): these results belong to
              // the previous token. Never show or cache them — fetch
              // afresh for the current token instead. This check comes
              // BEFORE the cancelled check on purpose: a token change
              // always cancels this effect run, so checking cancelled
              // first would make this recovery unreachable exactly
              // when it is needed. And every exit from this handler
              // calls finish() first — returning without it leaves
              // fetchInFlight latched forever and wedges the tab.
              if (xCloudTokenRef.current !== xCloudToken) {
                finish();
                if (mountedRef.current && fetchGamesRef.current) {
                  fetchGamesRef.current(background);
                }
                return;
              }
              if (cancelled) {
                finish();
                // Superseded by an effect re-run that was not a
                // token change (the token case is handled above):
                // the new run found the fetch latch held and
                // skipped, so hand the fetch to it instead of
                // discarding these results with no refetch.
                if (mountedRef.current && fetchGamesRef.current) {
                  fetchGamesRef.current(background);
                }
                return;
              }
              // An empty catalog is a failure, not a result: applying
              // it would blank a working screen and overwrite the
              // saved catalog with nothing.
              if (!_titles || _titles.length === 0) {
                fail(
                  new Error(
                    t(
                      'Failed to load games. Please check your connection and try again.',
                    ),
                  ),
                );
                return;
              }
              // The titles land as soon as they are hydrated, with
              // the previous sections still in place: one slow
              // curated list must not hold the whole tab hostage
              // while everything waits for it.
              appliedTokenRef.current = xCloudToken;
              appliedOwnerRef.current =
                catalogOwnerOf(webTokenRef.current);
              applyCatalog(_titles, lastSectionsRef.current);
              const aux = await auxPromise;
              // Check the token AGAIN after the wait: the curated
              // lists took seconds to arrive and the token may have
              // changed meanwhile. Never stamp or cache a previous
              // token's catalog as the current one's fresh copy.
              // (Token check before the cancelled check, and finish()
              // on every exit — see the note at the top of this
              // handler.)
              if (xCloudTokenRef.current !== xCloudToken) {
                finish();
                if (mountedRef.current && fetchGamesRef.current) {
                  fetchGamesRef.current(background);
                }
                return;
              }
              if (cancelled) {
                finish();
                // Superseded by an effect re-run that was not a
                // token change (the token case is handled above):
                // the new run found the fetch latch held and
                // skipped, so hand the fetch to it instead of
                // discarding these results with no refetch.
                if (mountedRef.current && fetchGamesRef.current) {
                  fetchGamesRef.current(background);
                }
                return;
              }
              const prev = lastSectionsRef.current;
              const sections = {
                popular: aux[0] !== null ? aux[0] : prev.popular,
                leaving: aux[1] !== null ? aux[1] : prev.leaving,
                mkb: aux[2] !== null ? aux[2] : prev.mkb,
                touch: aux[3] !== null ? aux[3] : prev.touch,
                newIds: aux[4] !== null ? aux[4] : prev.newIds,
                recentIds: aux[5] !== null ? aux[5] : prev.recentIds,
              };
              lastFetchToken.current = xCloudToken;
              appliedTokenRef.current = xCloudToken;
              appliedOwnerRef.current =
                catalogOwnerOf(webTokenRef.current);
              catalogRetryCountRef.current = 0;
              // A retry timer armed by an earlier failure must not
              // fire now that a fetch has succeeded: it would
              // re-download and re-save the whole catalog for
              // nothing.
              if (catalogRetryTimerRef.current) {
                clearTimeout(catalogRetryTimerRef.current);
                catalogRetryTimerRef.current = null;
              }
              applyCatalog(_titles, sections);
              saveCatalogCache(
                _titles,
                sections,
                catalogOwnerOf(webTokenRef.current),
              );
              cacheSavedAt.current = Date.now();
              cacheApplied.current = true;
              finish();
            })
            .catch(fail);
        })
        .catch(fail);
    };
    fetchGamesRef.current = fetchGames;

    if (xCloudToken && !fetchInFlight.current) {
      // OneCast-style open: render the saved catalog instantly when one
      // exists, and only hit the network when there is none, when it is
      // stale, or when the token changed (e.g. a fresh login — possibly
      // a different account, whose entitlements differ).
      if (!cacheApplied.current) {
        const cache = loadCatalogCache();
        if (cache) {
          // The cached entitlements belong to the account that
          // fetched them: serve the cache only when it is known to
          // be this account's. When the owner is unknown on either
          // side (a pre-owner-tracking cache, or the web token not
          // ready yet) the cache is served and the fresh fetch that
          // follows re-stamps it with its true owner.
          const owner = catalogOwnerOf(webTokenRef.current);
          if (!cache.owner || !owner || cache.owner === owner) {
            applyCatalog(cache.titles, cache.sections);
            // Provenance unknown for fail()'s foreign-catalog drop:
            // a cache display must never be dropped by it.
            appliedTokenRef.current = null;
            appliedOwnerRef.current = null;
            cacheApplied.current = true;
            cacheSavedAt.current = cache.savedAt;
            // Stamp lastFetchToken ONLY when the owner is known to
            // match: with the owner unknown on either side the cache
            // is served for instant display, but the background fetch
            // below must still run and re-stamp the cache with its
            // true owner — otherwise a different account's catalog
            // would be presented as this account's until the TTL
            // expires.
            if (cache.owner && owner && cache.owner === owner) {
              lastFetchToken.current = xCloudToken;
            }
          }
        }
      }
      if (!cacheApplied.current) {
        fetchGames(false);
      } else if (
        lastFetchToken.current !== xCloudToken ||
        Date.now() - cacheSavedAt.current > CATALOG_TTL_MS
      ) {
        fetchGames(true);
      }
    }

    const updateLayout = () => {
      const {width, height} = Dimensions.get('window');
      setNumColumns(width > height ? 4 : 2);
    };

    updateLayout();
    const subscription = Dimensions.addEventListener('change', updateLayout);

    return () => {
      cancelled = true;
      subscription?.remove();
      // The next run starts with a fresh retry budget: without this,
      // an account that burned its retries would leave the NEXT
      // account with none until some fetch happened to succeed.
      catalogRetryCountRef.current = 0;
      if (catalogRetryTimerRef.current) {
        clearTimeout(catalogRetryTimerRef.current);
        catalogRetryTimerRef.current = null;
      }
    };
  }, [xCloudToken, navigation, applyCatalog, t]);

  const onRefresh = React.useCallback(() => {
    if (fetchInFlight.current) {
      return;
    }
    setRefreshing(true);
    if (fetchGamesRef.current) {
      fetchGamesRef.current(true);
    } else {
      setRefreshing(false);
    }
  }, []);

  // Stable identity: TitleItem is memoised, and a fresh handler on
  // every render would defeat the memo for every tile in every list.
  const handleViewDetail = React.useCallback(
    titleItem => {
      navigation.navigate('TitleDetail', {titleItem});
    },
    [navigation],
  );

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({animated: true, offset: 0});
  };

  // Group the loaded library by its real catalog genres, and pick out
  // the games included with the user's subscription. Memoised: these
  // walk the whole catalog, so they must not re-run on unrelated renders.
  const {genreMap, genreSections, includedTitles} = React.useMemo(() => {
    const _genreMap = {};
    titles.forEach(item => {
      (item.Categories || []).forEach(cat => {
        if (!_genreMap[cat]) {
          _genreMap[cat] = [];
        }
        _genreMap[cat].push(item);
      });
    });
    const _genreSections = Object.keys(_genreMap)
      .filter(cat => cat !== 'Other' && _genreMap[cat].length >= 8)
      .sort((a, b) => _genreMap[b].length - _genreMap[a].length);
    const _includedTitles = titles.filter(
      item => getTitleBadge(item) === 'GP',
    );
    return {
      genreMap: _genreMap,
      genreSections: _genreSections,
      includedTitles: _includedTitles,
    };
  }, [titles]);

  /**
   * 0 - recent
   * 1 - new
   * 2 - own
   * 3 - all
   *
   * The visible list is computed in a memo, not written into a ref
   * during render: a discarded render could otherwise leave the ref
   * describing a list the committed screen never showed, while the
   * header count below reads the same value.
   */
  const {visibleTitles, currentTitleText} = React.useMemo(() => {
    let list;
    let text = t('Xcloud');
    switch (current) {
      case 0:
        list = RecentTitles;
        text = t('Recently');
        break;
      case 1:
        list = newTitles;
        text = t('Newest');
        break;
      case 2:
        list = orgTitles;
        text = t('Own');
        break;
      case 3:
        list = titles;
        text = t('All');
        break;
      case 99: {
        // A section opened from the home rows resolves its data LIVE
        // from the current state lists, never from a snapshot taken when
        // it was tapped: during a cold load the lists are still filling,
        // and a snapshot would freeze the section at its partial contents.
        let _sectionData = [];
        if (customSection) {
          switch (customSection.source) {
            case 'included':
              _sectionData = includedTitles;
              break;
            case 'popular':
              _sectionData = popularTitles;
              break;
            case 'leaving':
              _sectionData = leavingTitles;
              break;
            case 'mkb':
              _sectionData = mkbTitles;
              break;
            case 'touch':
              _sectionData = touchTitles;
              break;
            default:
              _sectionData =
                customSection.source &&
                customSection.source.indexOf('genre:') === 0
                  ? genreMap[customSection.source.slice(6)] || []
                  : [];
          }
        }
        list = _sectionData;
        text = customSection ? customSection.title : t('Xcloud');
        break;
      }
      default:
        list = [];
        text = t('Xcloud');
        break;
    }

    if (keyword.length > 0) {
      list = list.filter(title => {
        return (
          (title.ProductTitle || '')
            .toUpperCase()
            .indexOf(keyword.toUpperCase()) > -1
        );
      });
    }
    return {visibleTitles: list, currentTitleText: text};
  }, [
    current,
    RecentTitles,
    newTitles,
    orgTitles,
    titles,
    customSection,
    includedTitles,
    popularTitles,
    leavingTitles,
    mkbTitles,
    touchTitles,
    genreMap,
    keyword,
    t,
  ]);

  const totalPages = Math.max(1, Math.ceil(visibleTitles.length / 20));

  const loadMoreData = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleSelectCategories = val => {
    setCurrent(val);
    setCustomSection(null);
    setView('grid');
    setCurrentPage(1);
    scrollToTop();
  };

  const handleShowSection = (sectionTitle, source) => {
    setCustomSection({title: sectionTitle, source});
    setCurrent(99);
    setView('grid');
    setCurrentPage(1);
    scrollToTop();
  };

  // Show 20 titles per page
  const endIdx = currentPage * 20;
  let showTitles = visibleTitles.slice(0, endIdx);

  const renderSection = (sectionTitle, data, onShowAll) => {
    if (!data || data.length === 0) {
      return null;
    }
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text
            variant="titleLarge"
            style={styles.sectionTitle}
            numberOfLines={1}
            ellipsizeMode="tail">
            {sectionTitle}
          </Text>
          {hydrated && (
            <Text variant="titleLarge" style={styles.sectionCount}>
              {'(' + data.length + ')'}
            </Text>
          )}
          <Text
            style={styles.showAll}
            onPress={onShowAll}
            accessibilityRole="button">
            {t('Show all')}
          </Text>
        </View>
        <FlatList
          horizontal
          data={data.slice(0, 10)}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={3}
          keyExtractor={(item, index) =>
            (item.productId || item.ProductTitle || 'title') + '-' + index
          }
          showsHorizontalScrollIndicator={false}
          renderItem={({item}) => {
            return (
              <View style={styles.rowItem}>
                <TitleItem titleItem={item} onPress={handleViewDetail} />
              </View>
            );
          }}
        />
      </View>
    );
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="#107C10"
      colors={['#107C10']}
    />
  );

  return (
    <>
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#107C10" />
          <Text style={styles.spinnerTextStyle}>{t('Loading...')}</Text>
        </View>
      )}

      {/* The main UI renders only once a token exists: during the
          grace wait the spinner below owns the whole screen, instead
          of the two stacking as half-screens. */}
      {!!xCloudToken && (
        <>
          <View style={styles.gameContainer}>
            <Appbar.Header>
              {view === 'grid' && (
                <Appbar.Action
                  icon="arrow-left"
                  onPress={() => {
                    // Leaving the section also leaves the search behind:
                    // a stale keyword silently filtered the home
                    // sections otherwise.
                    setKeyword('');
                    setCurrentPage(1);
                    setView('home');
                  }}
                />
              )}
              <Appbar.Content
                title={view === 'home' ? t('Xcloud') : currentTitleText}
              />
              {view !== 'home' && hydrated && (
                <Text variant="titleLarge" style={styles.appbarCount}>
                  {'(' + visibleTitles.length + ')'}
                </Text>
              )}
            </Appbar.Header>

            {view === 'home' ? (
              <ScrollView refreshControl={refreshControl}>
                <View style={styles.searchBar}>
                  <TextInput
                    style={[
                      styles.searchInput,
                      {color: theme.colors.onSurface},
                    ]}
                    placeholder={t('Search')}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={keyword}
                    onChangeText={text => {
                      setKeyword(text);
                      setCurrentPage(1);
                      if (text.length > 0) {
                        setCurrent(3);
                        setCustomSection(null);
                        setView('grid');
                      }
                    }}
                  />
                  {keyword.length > 0 && (
                    <Text
                      style={[
                        styles.clearSearch,
                        {color: theme.colors.onSurface},
                      ]}
                      accessibilityRole="button"
                      onPress={() => {
                        setKeyword('');
                        setCurrentPage(1);
                      }}>
                      ✕
                    </Text>
                  )}
                </View>
                {renderSection(t('Jump back in'), RecentTitles, () =>
                  handleSelectCategories(0),
                )}
                {renderSection(
                  t('Included in your subscription'),
                  includedTitles,
                  () =>
                    handleShowSection(
                      t('Included in your subscription'),
                      'included',
                    ),
                )}
                {renderSection(t('Most popular'), popularTitles, () =>
                  handleShowSection(t('Most popular'), 'popular'),
                )}
                {renderSection(t('Recently added'), newTitles, () =>
                  handleSelectCategories(1),
                )}
                {renderSection(t('Leaving soon'), leavingTitles, () =>
                  handleShowSection(t('Leaving soon'), 'leaving'),
                )}
                {renderSection(t('Stream your own game'), orgTitles, () =>
                  handleSelectCategories(2),
                )}
                {renderSection(t('Mouse and keyboard'), mkbTitles, () =>
                  handleShowSection(t('Mouse and keyboard'), 'mkb'),
                )}
                {renderSection(t('Touch controls'), touchTitles, () =>
                  handleShowSection(t('Touch controls'), 'touch'),
                )}
                {genreSections.map(cat => (
                  <React.Fragment key={cat}>
                    {renderSection(cat, genreMap[cat], () =>
                      handleShowSection(cat, 'genre:' + cat),
                    )}
                  </React.Fragment>
                ))}
                {renderSection(t('All games'), titles, () =>
                  handleSelectCategories(3),
                )}
                {!loading && titles.length === 0 && (
                  <Pressable onPress={onRefresh}>
                    <Empty />
                  </Pressable>
                )}
              </ScrollView>
            ) : (
              <>
            <View style={styles.searchBar}>
              <TextInput
                style={[styles.searchInput, {color: theme.colors.onSurface}]}
                placeholder={t('Search')}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={keyword}
                autoFocus={keyword.length > 0}
                onChangeText={text => {
                  setKeyword(text);
                  // Any change to the search restarts paging at page 1:
                  // the accumulated page count belongs to the old
                  // keyword's result set.
                  setCurrentPage(1);
                  if (text.length > 0 && current !== 3) {
                    // Searching always covers the whole library, like
                    // the website — not just the open section.
                    setCurrent(3);
                    setCustomSection(null);
                  }
                }}
              />
              {keyword.length > 0 && (
                <Text
                  style={[
                    styles.clearSearch,
                    {color: theme.colors.onSurface},
                  ]}
                  accessibilityRole="button"
                  onPress={() => {
                    setKeyword('');
                    setCurrentPage(1);
                  }}>
                  ✕
                </Text>
              )}
            </View>

            {!loading && !showTitles.length && (
              <Pressable onPress={onRefresh}>
                <Empty />
              </Pressable>
            )}

            {showTitles.length > 0 && (
              <>
                <FlatList
                  ref={flatListRef}
                  data={showTitles}
                  numColumns={numColumns}
                  key={numColumns}
                  keyExtractor={(item, index) =>
                    (item.productId || 'title') + '-' + index
                  }
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={true}
                  refreshControl={refreshControl}
                  contentContainerStyle={styles.listContainer}
                  renderItem={({item}) => {
                    return (
                      <View
                        style={
                          numColumns === 2 ? styles.listItemH : styles.listItemV
                        }>
                        <TitleItem
                          titleItem={item}
                          onPress={handleViewDetail}
                        />
                      </View>
                    );
                  }}
                  onEndReached={loadMoreData}
                  onEndReachedThreshold={0.1}
                />
              </>
            )}
              </>
            )}
          </View>

          {view === 'grid' && (
            <FAB.Group
              open={fabOpen}
            visible
            icon={fabOpen ? 'filter' : 'filter-outline'}
            actions={[
              {
                icon: 'gamepad-variant',
                label: t('Recently'),
                onPress: () => handleSelectCategories(0),
              },
              {
                icon: 'new-box',
                label: t('Newest'),
                onPress: () => handleSelectCategories(1),
              },
              {
                icon: 'account-arrow-down',
                label: t('Own'),
                onPress: () => handleSelectCategories(2),
              },
              {
                icon: 'apps-box',
                label: t('All'),
                onPress: () => handleSelectCategories(3),
              },
            ]}
            onStateChange={({open}) => setFabOpen(open)}
            />
          )}
        </>
      )}

      {isLimited && (
        <View style={styles.container}>
          <View>
            <Text style={styles.tips}>
              {t('NoXGP')}
            </Text>
          </View>
          {getLastAuthError() ? (
            <Text
              style={{
                marginTop: 12,
                textAlign: 'center',
                opacity: 0.7,
                paddingHorizontal: 24,
              }}>
              {getLastAuthError()}
            </Text>
          ) : null}
          <Button
            mode="contained"
            onPress={retryAuth}
            style={{marginTop: 16}}>
            {t('Retry')}
          </Button>
        </View>
      )}

      {!xCloudToken && !tokenWaitExpired && (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#107C10" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tips: {
    textAlign: 'center',
    lineHeight: 30,
  },
  spinnerTextStyle: {
    color: '#107C10',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  gameContainer: {
    flex: 1,
  },
  listContainer: {},
  listItemH: {
    width: '50%',
    justifyContent: 'center',
  },
  listItemV: {
    width: '25%',
    justifyContent: 'center',
  },
  searchBar: {
    margin: 12,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(128,128,128,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 2,
  },
  clearSearch: {
    fontSize: 16,
    paddingLeft: 10,
    paddingRight: 2,
  },
  section: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontWeight: 'bold',
    // Take the available width and ellipsize, so a long title can no
    // longer push "Show all" off the right edge of the screen.
    flex: 1,
    marginRight: 8,
  },
  sectionCount: {
    fontWeight: 'bold',
    // The count is its own element that never shrinks: when it was
    // appended to the title string, a long title ("Included in your
    // subscription") ellipsized the count itself away.
    flexShrink: 0,
    marginRight: 8,
  },
  appbarCount: {
    fontWeight: 'bold',
    flexShrink: 0,
    marginRight: 12,
  },
  showAll: {
    color: '#52B043',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  rowItem: {
    width: 175,
  },
});

export default CloudScreen;
