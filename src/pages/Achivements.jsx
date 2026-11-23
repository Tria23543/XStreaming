import React from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import {Card, Text, ProgressBar} from 'react-native-paper';
import Spinner from 'react-native-loading-spinner-overlay';
import Empty from '../components/Empty';
import {debugFactory} from '../utils/debug';
import {useTranslation} from 'react-i18next';
import moment from 'moment';
import {useSelector} from 'react-redux';
import WebApi from '../web';

const log = debugFactory('AchivementScreen');

function AchivementScreen({navigation}) {
  const {t} = useTranslation();

  const [loading, setLoading] = React.useState(false);
  const [archivements, setArchivements] = React.useState([]);
  const webToken = useSelector(state => state.webToken);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const webApi = new WebApi(webToken);
    webApi
      .getHistoryAchivements()
      .then(data => {
        if (!cancelled) {
          setArchivements(data);
        }
      })
      .catch(e => {
        log.error('GetHistoryAchivements error:', e?.message || e);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [webToken]);

  const formatTime = isoString => {
    if (!isoString) {
      return '';
    }
    const date = moment(isoString).local();
    if (!date.isValid()) {
      // An unparseable value used to render moment's literal
      // "Invalid date" on the card.
      return '';
    }
    return date.format('YYYY-MM-DD HH:mm:ss');
  };

  const scoreRatio = infos => {
    const max = Number(infos.maxGamerscore) || 0;
    const cur = Number(infos.currentGamerscore) || 0;
    if (max <= 0) {
      return 0;
    }
    return Math.min(Math.max(cur / max, 0), 1);
  };

  return (
    <View style={styles.container}>
      <Spinner
        visible={loading}
        color={'#107C10'}
        textContent={t('Loading...')}
        textStyle={styles.spinnerTextStyle}
      />

      {!loading && !archivements.length && <Empty />}

      {archivements.length > 0 && (
        <ScrollView>
          {archivements.map((infos, idx) => {
            return (
              <Card
                style={styles.card}
                key={infos.titleId || idx}
                onPress={() => {
                  navigation.navigate('AchievementDetail', {
                    name: infos.name,
                    titleId: infos.titleId,
                  });
                }}>
                <Card.Content style={styles.listItem}>
                  <View style={styles.title}>
                    <Text style={styles.text} variant="titleMedium">
                      {infos.name}
                    </Text>
                  </View>
                  <View style={styles.time}>
                    <Text style={styles.text} variant="titleSmall">
                      {formatTime(infos.lastUnlock)}
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <ProgressBar progress={scoreRatio(infos)} />
                  </View>
                  <View style={styles.footer}>
                    <View style={styles.score}>
                      <Text style={styles.text} variant="titleSmall">
                        {t('Score')}: {Number(infos.currentGamerscore) || 0}/
                        {Number(infos.maxGamerscore) || 0}
                      </Text>
                    </View>
                    <View style={styles.percent}>
                      <Text style={styles.text} variant="titleSmall">
                        {Math.floor(scoreRatio(infos) * 100) + '%'}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    flex: 1,
  },
  card: {
    marginBottom: 10,
  },
  spinnerTextStyle: {
    color: '#107C10',
  },
  listItem: {
    flex: 1,
    borderRadius: 5,
  },
  title: {
    flexDirection: 'row',
  },
  time: {
    flexDirection: 'row',
    marginTop: 2,
  },
  text: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  progressBar: {
    marginTop: 15,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginTop: 10,
  },
  score: {
    flex: 1,
  },
  percent: {
    marginLeft: 10,
  },
});

export default AchivementScreen;
