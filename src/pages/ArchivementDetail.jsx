import React from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  RefreshControl,
} from 'react-native';
import {SegmentedButtons} from 'react-native-paper';
import Spinner from 'react-native-loading-spinner-overlay';
import {useTranslation} from 'react-i18next';
import {useSelector} from 'react-redux';
import {debugFactory} from '../utils/debug';
import WebApi from '../web';
import ArchivementItem from '../components/ArchivementItem';
import Empty from '../components/Empty';

const log = debugFactory('ArchivementDetail');

function ArchivementDetail({navigation, route}) {
  const {t} = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const [current, setCurrent] = React.useState('all');
  const [refreshing, setRefreshing] = React.useState(false);
  const [numColumns, setNumColumns] = React.useState(2);
  const [archivements, setArchivements] = React.useState([]);

  const webToken = useSelector(state => state.webToken);
  // Guards every async completion on this screen (effect fetch and
  // pull-to-refresh alike): a fetch resolving after unmount — or
  // after the screen moved to another title — must not set state.
  const mountedRef = React.useRef(true);
  // The title the screen currently shows: mountedRef alone cannot
  // stop a pull-to-refresh started for the PREVIOUS title from
  // applying its data after the params changed on the same mounted
  // screen (the new effect run resets mountedRef to true).
  const currentTitleRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    currentTitleRef.current = route.params?.titleId;
    log.info('ArchivementDetail titleId:', route.params?.titleId);
    if (route.params?.titleId) {
      setLoading(true);
      const webApi = new WebApi(webToken);
      webApi
        .getAchivementDetail(route.params?.titleId)
        .then(data => {
          if (!cancelled) {
            setArchivements(data);
          }
        })
        .catch(e => {
          log.error('GetAchivementDetail error:', e?.message || e);
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }
    navigation.setOptions({
      title: route.params?.name || '',
    });
    const updateLayout = () => {
      const {width, height} = Dimensions.get('window');
      setNumColumns(width > height ? 4 : 2);
    };
    updateLayout();
    const subscription = Dimensions.addEventListener('change', updateLayout);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      subscription?.remove();
    };
  }, [route.params?.titleId, route.params?.name, navigation, webToken]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const webApi = new WebApi(webToken);
      if (route.params?.titleId) {
        const titleId = route.params.titleId;
        const results = await webApi.getAchivementDetail(titleId);
        // Apply only if the screen still shows the title this
        // refresh was started for.
        if (mountedRef.current && currentTitleRef.current === titleId) {
          setArchivements(results);
        }
      }
    } catch (e) {
      log.error('GetAchivementDetail refresh error:', e?.message || e);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [webToken, route.params?.titleId]);

  let showArchivements = [];
  if (current === 'unlocked') {
    showArchivements = archivements.filter(item => {
      return item.progressState === 'Achieved';
    });
  } else if (current === 'lock') {
    showArchivements = archivements.filter(item => {
      return item.progressState !== 'Achieved';
    });
  } else {
    showArchivements = archivements;
  }

  return (
    <View style={styles.container}>
      <Spinner
        visible={loading}
        color={'#107C10'}
        textContent={t('Loading...')}
        textStyle={styles.spinnerTextStyle}
      />
      <SegmentedButtons
        value={current}
        onValueChange={setCurrent}
        buttons={[
          {
            value: 'all',
            label: t('All'),
          },
          {
            value: 'unlocked',
            label: t('Unlocked'),
          },
          {
            value: 'lock',
            label: t('Locked'),
          },
        ]}
      />

      <FlatList
        data={showArchivements}
        numColumns={numColumns}
        key={numColumns}
        keyExtractor={(item, index) =>
          item && item.id ? String(item.id) : String(index)
        }
        ListEmptyComponent={!loading ? <Empty /> : null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({item}) => {
          return (
            <View
              style={numColumns === 2 ? styles.listItemH : styles.listItemV}>
              <ArchivementItem item={item} />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spinnerTextStyle: {
    color: '#107C10',
  },
  listItemH: {
    width: '50%',
    justifyContent: 'center',
  },
  listItemV: {
    width: '25%',
    justifyContent: 'center',
  },
});

export default ArchivementDetail;
