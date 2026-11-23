import React from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import FastImage from 'react-native-fast-image';
import {Text, Button, HelperText} from 'react-native-paper';
import Spinner from 'react-native-loading-spinner-overlay';
import {useTranslation} from 'react-i18next';
import {debugFactory} from '../utils/debug';
import {getTitleBadge, isEntitled} from '../components/TitleItem';

const log = debugFactory('TitleDetailScreen');

function TitleDetail({navigation, route}) {
  const {t} = useTranslation();
  // Initialised FROM the route param: starting at null/false made
  // the full-screen spinner flash for the first frame(s) even when a
  // title was passed, and delayed the no-title error by a frame too.
  // The effect below still keeps both in sync when params change.
  const [titleItem, setTitleItem] = React.useState(
    () => route.params?.titleItem || null,
  );
  const [loadFailed, setLoadFailed] = React.useState(
    () => !route.params?.titleItem,
  );

  React.useEffect(() => {
    log.info('TitleDetail titleItem:', route.params?.titleItem);
    if (route.params?.titleItem) {
      setTitleItem(route.params.titleItem);
      setLoadFailed(false);
    } else {
      // Reached without a title (should not happen from the library):
      // show an error with a way back instead of spinning forever.
      // Clear any previously shown title too, or the error view —
      // gated on there being no title — could never appear.
      setTitleItem(null);
      setLoadFailed(true);
    }
    navigation.setOptions({
      // The ?. must cover titleItem too: params present without a
      // titleItem used to throw here.
      title: route.params?.titleItem?.ProductTitle || '',
    });
  }, [route.params?.titleItem, navigation]);

  const handleStartGame = () => {
    log.info('HandleStartCloudGame titleId:', titleItem.XCloudTitleId);
    navigation.navigate({
      name: 'Stream',
      params: {
        sessionId: titleItem.titleId || titleItem.XCloudTitleId,
        // Stream reads the settings itself; the settings param that
        // used to be passed here was never read.
        streamType: 'cloud',
      },
    });
  };

  let isByorg = false;
  if (
    titleItem &&
    !titleItem.XCloudTitleId &&
    titleItem.details &&
    titleItem.details.programs
  ) {
    if (
      Array.isArray(titleItem.details.programs) &&
      titleItem.details.programs.indexOf('BYOG') > -1
    ) {
      isByorg = true;
    }
  }

  const badge = getTitleBadge(titleItem);

  return (
    <View style={styles.container}>
      <Spinner
        visible={!titleItem && !loadFailed}
        textContent={t('Loading...')}
        textStyle={styles.spinnerTextStyle}
      />

      {!titleItem && loadFailed && (
        <View style={styles.errorWrap}>
          <Text variant="titleMedium" style={styles.errorText}>
            {t('NoData')}
          </Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            {t('Back')}
          </Button>
        </View>
      )}

      {titleItem && (
        <>
          <ScrollView style={styles.scrollView}>
            {titleItem.Image_Poster && titleItem.Image_Poster.URL ? (
              <FastImage
                source={{
                  uri: 'https:' + titleItem.Image_Poster.URL,
                  cache: FastImage.cacheControl.immutable,
                }}
                resizeMode={FastImage.resizeMode.cover}
                style={styles.image}
              />
            ) : (
              <View style={styles.image} />
            )}
            <View style={styles.textWrap}>
              <Text variant="titleLarge" style={styles.productTitle}>
                {titleItem.ProductTitle}
              </Text>
              <Text variant="titleMedium">{titleItem.PublisherName}</Text>
              {badge === 'GP' && (
                <Text variant="titleMedium" style={styles.gpText}>
                  {t('Included in your subscription')}
                </Text>
              )}
              {badge === 'OWNED' && (
                <Text variant="titleMedium" style={styles.gpText}>
                  {t('Stream your own game')}
                </Text>
              )}
              {badge === 'FREE' && (
                <Text variant="titleMedium" style={styles.gpText}>
                  {t('Free to play')}
                </Text>
              )}
              {badge === null && (
                <Text variant="titleMedium" style={styles.gpText}>
                  {t('Needs to be purchased')}
                </Text>
              )}
            </View>

            <View style={styles.tagsWrap}>
              {isByorg && (
                <HelperText type="info" visible={true}>
                  {t('byorg')}
                </HelperText>
              )}
              {(titleItem.Categories || []).map(item => {
                return (
                  <View style={styles.tagContainer} key={item}>
                    <Text variant="titleSmall">{item}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.buttonWrap}>
            {isEntitled(titleItem) ? (
              <Button
                mode="contained"
                style={styles.button}
                onPress={handleStartGame}>
                &nbsp;{t('Start game')} &nbsp;
              </Button>
            ) : (
              <Button mode="contained" style={styles.button} disabled={true}>
                {t('Needs to be purchased')}
              </Button>
            )}
            <Button
              mode="outlined"
              style={styles.button}
              onPress={() => navigation.goBack()}>
              {t('Back')}
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginBottom: 20,
    textAlign: 'center',
  },
  container: {
    flex: 1,
  },
  spinnerTextStyle: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
    marginBottom: 120, // Adjust the marginBottom value to accommodate the button height
  },
  image: {
    width: '100%',
    height: 960 / 3,
  },
  textWrap: {
    padding: 10,
  },
  tagsWrap: {
    padding: 10,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tagContainer: {
    borderColor: '#999999',
    borderWidth: 1,
    borderRadius: 5,
    padding: 5,
    marginRight: 5,
    marginBottom: 10,
  },
  productTitle: {
    marginBottom: 10,
  },
  gpText: {
    color: '#52B043',
    marginTop: 4,
  },
  buttonWrap: {
    position: 'absolute',
    left: 0,
    width: '100%',
    bottom: 20,
    paddingLeft: 10,
    paddingRight: 10,
  },
  button: {
    marginTop: 10,
  },
});

export default TitleDetail;
