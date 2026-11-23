import React from 'react';
import {StyleSheet, View, ScrollView, RefreshControl} from 'react-native';
import {Card, Text, Avatar} from 'react-native-paper';
import Spinner from 'react-native-loading-spinner-overlay';
import Empty from '../components/Empty';
import {debugFactory} from '../utils/debug';
import {useTranslation} from 'react-i18next';
import {useSelector} from 'react-redux';
import {useIsFocused} from '@react-navigation/native';
import WebApi from '../web';

const log = debugFactory('FriendsScreen');

function FriendsScreen({navigation}) {
  const {t} = useTranslation();

  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [friends, setFriends] = React.useState([]);

  const webToken = useSelector(state => state.webToken);
  const isFocused = useIsFocused();

  // Shared with onRefresh below: the pull-to-refresh fetch needs the
  // same unmount guard as the effect's fetches.
  const mountedRef = React.useRef(true);
  // Whether the polling effect below has ever activated: its first
  // activation coincides with the mount fetch, so only later
  // activations fetch immediately.
  const pollActivatedRef = React.useRef(false);

  React.useEffect(() => {
    // Guard the async completions: a fetch that resolves after
    // unmount must not set state on a dead screen.
    let cancelled = false;
    mountedRef.current = true;
    setLoading(true);
    const webApi = new WebApi(webToken);
    webApi
      .getFriends()
      .then(data => {
        if (!cancelled) {
          setFriends(data);
        }
      })
      .catch(e => {
        log.error('GetFriends error:', e?.message || e);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [webToken]);

  // Poll for presence updates only while this screen is visible:
  // the screen stays mounted under pushed screens, and polling
  // there burns battery and network on a list nobody is looking at.
  React.useEffect(() => {
    if (!isFocused || !webToken) {
      return;
    }
    const webApi = new WebApi(webToken);
    const poll = () => {
      webApi
        .getFriends()
        .then(data => {
          if (mountedRef.current) {
            setFriends(data);
          }
        })
        .catch(e => {
          log.error('GetFriends polling error:', e?.message || e);
        });
    };
    // Refresh immediately when the user RETURNS to this screen:
    // without it, presence can stay up to 30s stale after coming
    // back, because the interval's first tick is a full period away
    // and the mount fetch does not re-run on focus. The very first
    // activation is skipped — the mount effect just fetched.
    if (pollActivatedRef.current) {
      poll();
    }
    pollActivatedRef.current = true;
    const id = setInterval(poll, 30 * 1000);
    return () => clearInterval(id);
  }, [webToken, isFocused]);

  const drawPresence = userinfo => {
    for (const app in userinfo.presenceDetails) {
      // A presence entry can be null (a title with no presence): the
      // old dereference threw and blanked the whole friends list.
      const detail = userinfo.presenceDetails[app];
      if (detail && detail.IsGame && detail.IsPrimary) {
        return detail.PresenceText;
      }
    }

    return userinfo.presenceText;
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const webApi = new WebApi(webToken);
      const _friends = await webApi.getFriends();
      if (mountedRef.current) {
        setFriends(_friends);
      }
    } catch (e) {
      log.error('GetFriends refresh error:', e?.message || e);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [webToken]);

  return (
    <View style={styles.container}>
      <Spinner
        visible={loading}
        color={'#107C10'}
        textContent={t('Loading...')}
        textStyle={styles.spinnerTextStyle}
      />

      {!loading && !friends.length && (
        <ScrollView
          contentContainerStyle={{flexGrow: 1}}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          <Empty />
        </ScrollView>
      )}

      {friends.length > 0 && (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          {friends.map((userinfo, idx) => {
            return (
              <Card key={userinfo.xuid || idx} style={styles.card}>
                <Card.Content style={styles.listItem}>
                  <Avatar.Image
                    style={styles.avatar}
                    size={64}
                    source={
                      userinfo.displayPicRaw
                        ? {uri: userinfo.displayPicRaw}
                        : undefined
                    }
                  />
                  <View>
                    <View style={styles.title}>
                      <Text style={styles.text} variant="titleMedium">
                        {userinfo.modernGamertag}
                      </Text>
                      {userinfo.modernGamertagSuffix && (
                        <Text
                          style={[styles.text, styles.suffix]}
                          variant="titleSmall">
                          #{userinfo.modernGamertagSuffix}
                        </Text>
                      )}
                    </View>
                    <View style={styles.title}>
                      <Text style={styles.text} variant="labelSmall">
                        {userinfo.displayName}
                      </Text>
                      {userinfo.realName && (
                        <Text
                          style={[styles.text, styles.realName]}
                          variant="labelSmall">
                          ({userinfo.realName})
                        </Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.text} variant="labelSmall">
                        {drawPresence(userinfo)}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 5,
  },
  avatar: {
    marginRight: 10,
  },
  title: {
    flexDirection: 'row',
  },
  text: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  suffix: {
    marginTop: 3,
    marginLeft: 5,
  },
  realName: {
    marginLeft: 5,
  },
});

export default FriendsScreen;
