import React from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import {Text, Appbar, FAB} from 'react-native-paper';
import Spinner from 'react-native-loading-spinner-overlay';
import {useSelector} from 'react-redux';
import TitleItem from '../components/TitleItem';
import XcloudApi from '../xCloud';
import Empty from '../components/Empty';
import {debugFactory} from '../utils/debug';
import {useTranslation} from 'react-i18next';

const log = debugFactory('CloudScreen');

function CloudScreen({navigation, route}) {
  const {t} = useTranslation();
  const streamingTokens = useSelector(state => state.streamingTokens);

  // log.info('streamingTokens:', streamingTokens);

  const [current, setCurrent] = React.useState(3);
  const [numColumns, setNumColumns] = React.useState(2);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [loading, setLoading] = React.useState(false);
  const [loadmoring, setLoadmoring] = React.useState(false);
  const [isLimited, setIsLimited] = React.useState(false);
  const [titles, setTitles] = React.useState([]);
  const [newTitles, setNewTitles] = React.useState([]);
  const [titlesMap, setTitlesMap] = React.useState({});
  const [RecentTitles, setRecentNewTitles] = React.useState([]);
  const [orgTitles, setOrgTitles] = React.useState([]);
  const [keyword, setKeyword] = React.useState('');
  const flatListRef = React.useRef(null);
  const isFetchGame = React.useRef(false);
  const [fabOpen, setFabOpen] = React.useState(false);
  const [view, setView] = React.useState('home');
  const [popularTitles, setPopularTitles] = React.useState([]);
  const [leavingTitles, setLeavingTitles] = React.useState([]);
  const [mkbTitles, setMkbTitles] = React.useState([]);
  const [customSection, setCustomSection] = React.useState(null);

  const currentTitles = React.useRef([]);
  const totalPage = React.useRef(0);

  React.useEffect(() => {
    if (route.params?.keyword) {
      setKeyword(route.params.keyword);
      setView('grid');
    }
    if (!streamingTokens.xCloudToken) {
      setIsLimited(true);
    }
    const fetchGames = () => {
      if (streamingTokens.xCloudToken) {
        const _xCloudApi = new XcloudApi(
          streamingTokens.xCloudToken.getDefaultRegion().baseUri,
          streamingTokens.xCloudToken.data.gsToken,
          'cloud',
        );
        setLoading(true);
        _xCloudApi.getTitles().then(res => {
          // log.info('_xCloudApi.getTitles res: ', titles);
          if (res.results) {
            _xCloudApi.getGamePassProducts(res.results).then(_titles => {
              setTitles(_titles);

              const _titleMap = {};
              const _orgTitles = [];
              _titles.forEach(item => {
                _titleMap[item.productId] = item;

                // Get org games
                if (
                  !item.XCloudTitleId &&
                  item.details &&
                  item.details.programs &&
                  item.details.programs.indexOf('BYOG') > -1
                ) {
                  _orgTitles.push(item);
                }
              });

              setTitlesMap(_titleMap);
              setOrgTitles(_orgTitles);

              // Get curated gallery lists from Microsoft's catalog:
              // Popular, Leaving soon, Mouse and keyboard
              const mapSigl = (siglId, setter) => {
                _xCloudApi.getSiglTitles(siglId).then(list => {
                  const mapped = [];
                  (list || []).forEach(item => {
                    if (item.id && _titleMap[item.id]) {
                      mapped.push(_titleMap[item.id]);
                    }
                  });
                  setter(mapped);
                });
              };
              mapSigl(
                'e7590b22-e299-44db-ae22-25c61405454c',
                setPopularTitles,
              );
              mapSigl(
                '393f05bf-e596-4ef6-9487-6d4fa0eab987',
                setLeavingTitles,
              );
              mapSigl('8fa264dd-124f-4af3-97e8-596fcdf4b486', setMkbTitles);

              // Get new games
              _xCloudApi.getNewTitles().then(newTitleRes => {
                const _newTitles = [];
                newTitleRes.forEach(item => {
                  if (item.id && _titleMap[item.id]) {
                    _newTitles.push(_titleMap[item.id]);
                  }
                });
                setNewTitles(_newTitles);

                // Get recent games
                _xCloudApi.getRecentTitles().then(recentTitleRes => {
                  const results = recentTitleRes.results || [];
                  const _recentTitles = [];
                  results.forEach(item => {
                    if (item.details && item.details.productId) {
                      const productId = item.details.productId;
                      const productIdUp = productId.toUpperCase();
                      if (_titleMap[productId] || _titleMap[productIdUp]) {
                        _recentTitles.push(
                          _titleMap[productId] || _titleMap[productIdUp],
                        );
                      }
                    }
                  });
                  setRecentNewTitles(_recentTitles);
                  setLoading(false);
                  isFetchGame.current = true;
                });
              });
            });
          }
        });
      }
    };
    if (!isFetchGame.current) {
      fetchGames();
    }

    const updateLayout = () => {
      const {width, height} = Dimensions.get('window');
      setNumColumns(width > height ? 4 : 2);
    };

    updateLayout();
    const subscription = Dimensions.addEventListener('change', updateLayout);

    return () => {
      subscription?.remove();
    };
  }, [route.params?.keyword, streamingTokens.xCloudToken, navigation]);

  const handleViewDetail = titleItem => {
    navigation.navigate('TitleDetail', {titleItem});
  };

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({animated: true, offset: 0});
  };

  const loadMoreData = () => {
    if (currentPage <= totalPage.current) {
      setLoadmoring(true);
      setCurrentPage(currentPage + 1);
      setTimeout(() => {
        setLoadmoring(false);
      }, 1500);
    } else {
      setLoadmoring(false);
    }
  };

  const footLoading = () => {
    if (loadmoring) {
      return (
        <ActivityIndicator
          size="large"
          color="#0000ff"
          style={styles.loadingIndicator}
        />
      );
    } else {
      return null;
    }
  };

  const handleSelectCategories = val => {
    setCurrent(val);
    setCustomSection(null);
    setView('grid');
    setLoading(true);
    setCurrentPage(1);
    scrollToTop();
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleShowSection = (sectionTitle, data) => {
    setCustomSection({title: sectionTitle, data});
    setCurrent(99);
    setView('grid');
    setLoading(true);
    setCurrentPage(1);
    scrollToTop();
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  /**
   * 0 - recent
   * 1 - new
   * 2 - own
   * 3 - all
   */
  let currentTitleText = '';

  switch (current) {
    case 0:
      currentTitles.current = RecentTitles;
      currentTitleText = t('Recently');
      break;
    case 1:
      currentTitles.current = newTitles;
      currentTitleText = t('Newest');
      break;
    case 2:
      currentTitles.current = orgTitles;
      currentTitleText = t('Own');
      break;
    case 3:
      currentTitles.current = titles;
      currentTitleText = t('All');
      break;
    case 99:
      currentTitles.current = customSection ? customSection.data : [];
      currentTitleText = customSection ? customSection.title : 'xCloud';
      break;
    default:
      currentTitles.current = [];
      currentTitleText = 'xCloud';
      break;
  }

  if (keyword.length > 0) {
    currentTitles.current = currentTitles.current.filter(title => {
      return (
        title.ProductTitle.toUpperCase().indexOf(keyword.toUpperCase()) > -1
      );
    });
  }

  if (currentTitles.current.length > 0) {
    totalPage.current = Math.ceil(currentTitles.current.length / 20);
  }

  // Show 20 titles per page
  const endIdx = currentPage * 20;
  let showTitles = currentTitles.current.slice(0, endIdx);

  // Group the loaded library by its real catalog genres
  const genreMap = {};
  titles.forEach(item => {
    (item.Categories || []).forEach(cat => {
      if (!genreMap[cat]) {
        genreMap[cat] = [];
      }
      genreMap[cat].push(item);
    });
  });
  const genreSections = Object.keys(genreMap)
    .filter(cat => cat !== 'Other' && genreMap[cat].length >= 8)
    .sort((a, b) => genreMap[b].length - genreMap[a].length);

  const renderSection = (sectionTitle, data, onShowAll) => {
    if (!data || data.length === 0) {
      return null;
    }
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            {sectionTitle} ({data.length})
          </Text>
          <Text style={styles.showAll} onPress={onShowAll}>
            {t('Show all')}
          </Text>
        </View>
        <FlatList
          horizontal
          data={data.slice(0, 20)}
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

  return (
    <>
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#107C10" />
          <Text style={styles.spinnerTextStyle}>{t('Loading...')}</Text>
        </View>
      )}

      {!isLimited && (
        <>
          <View style={styles.gameContainer}>
            <Appbar.Header>
              {view === 'grid' && (
                <Appbar.Action
                  icon="arrow-left"
                  onPress={() => {
                    setView('home');
                  }}
                />
              )}
              <Appbar.Content
                title={
                  view === 'home'
                    ? 'Cloud'
                    : currentTitleText +
                      ' (' +
                      currentTitles.current.length +
                      ')'
                }
              />
            </Appbar.Header>

            {view === 'home' ? (
              <ScrollView>
                <View style={styles.searchBar}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('Search')}
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={keyword}
                    onChangeText={text => {
                      setKeyword(text);
                      if (text.length > 0) {
                        setCurrent(3);
                        setCustomSection(null);
                        setView('grid');
                      }
                    }}
                  />
                  {keyword.length > 0 && (
                    <Text
                      style={styles.clearSearch}
                      onPress={() => setKeyword('')}>
                      ✕
                    </Text>
                  )}
                </View>
                {renderSection(t('Jump back in'), RecentTitles, () =>
                  handleSelectCategories(0),
                )}
                {renderSection(t('Popular'), popularTitles, () =>
                  handleShowSection(t('Popular'), popularTitles),
                )}
                {renderSection(t('Recently added'), newTitles, () =>
                  handleSelectCategories(1),
                )}
                {renderSection(t('Leaving soon'), leavingTitles, () =>
                  handleShowSection(t('Leaving soon'), leavingTitles),
                )}
                {renderSection(t('Stream your own game'), orgTitles, () =>
                  handleSelectCategories(2),
                )}
                {renderSection(t('Mouse and keyboard'), mkbTitles, () =>
                  handleShowSection(t('Mouse and keyboard'), mkbTitles),
                )}
                {genreSections.map(cat => (
                  <React.Fragment key={cat}>
                    {renderSection(cat, genreMap[cat], () =>
                      handleShowSection(cat, genreMap[cat]),
                    )}
                  </React.Fragment>
                ))}
                {renderSection(t('All games'), titles, () =>
                  handleSelectCategories(3),
                )}
                {!loading && titles.length === 0 && <Empty />}
              </ScrollView>
            ) : (
              <>
            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder={t('Search')}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={keyword}
                autoFocus={keyword.length > 0}
                onChangeText={text => setKeyword(text)}
              />
              {keyword.length > 0 && (
                <Text
                  style={styles.clearSearch}
                  onPress={() => setKeyword('')}>
                  ✕
                </Text>
              )}
            </View>

            {!loading && !showTitles.length && <Empty />}

            {showTitles.length > 0 && (
              <>
                <FlatList
                  ref={flatListRef}
                  data={showTitles}
                  numColumns={numColumns}
                  key={numColumns}
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
                  ListFooterComponent={footLoading}
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
              {
                icon: 'magnify',
                onPress: () => setFabOpen(false),
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
            <Text style={styles.tips} category="s1">
              {t('NoXGP')}
            </Text>
          </View>
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
  categoryWrap: {
    width: 200,
    padding: 10,
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
  loadingIndicator: {
    padding: 20,
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
    color: '#ffffff',
    fontSize: 16,
    paddingVertical: 2,
  },
  clearSearch: {
    color: '#ffffff',
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
  },
  showAll: {
    color: '#52B043',
    fontWeight: 'bold',
  },
  rowItem: {
    width: 175,
  },
});

export default CloudScreen;
