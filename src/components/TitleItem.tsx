import React from 'react';
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {Text} from 'react-native-paper';

type Props = {
  titleItem: any;
  onPress: (titleItem: any) => {};
};

const TitleItem: React.FC<Props> = ({titleItem, onPress}) => {
  const [loading, setLoading] = React.useState(true);

  const isOwned =
    !titleItem.XCloudTitleId &&
    titleItem.details &&
    titleItem.details.programs &&
    titleItem.details.programs.indexOf('BYOG') > -1;

  // A game gets the GAME PASS badge only on positive evidence in its own
  // data: the GPULTIMATE program in its cloud offerings or in its
  // entitlement programs, or Streamability.WithGPU. Titles that are merely
  // streamable another way (BYOG / free-to-play like Fortnite) carry none
  // of these and get no badge. No evidence -> no badge.
  const offerings = titleItem.XCloudOfferings;
  let isGamePass = false;
  if (offerings) {
    isGamePass = Object.keys(offerings).some(key => {
      const offering = offerings[key];
      return (
        offering &&
        offering.Programs &&
        offering.Programs.indexOf('GPULTIMATE') > -1
      );
    });
  }
  if (
    !isGamePass &&
    titleItem.Streamability &&
    titleItem.Streamability.WithGPU
  ) {
    isGamePass = true;
  }
  if (
    !isGamePass &&
    titleItem.details &&
    titleItem.details.programs &&
    titleItem.details.programs.indexOf('GPULTIMATE') > -1
  ) {
    isGamePass = true;
  }

  const handlePress = () => {
    onPress && onPress(titleItem);
  };

  return (
    <Pressable onPress={handlePress}>
      <View style={styles.card}>
        {loading && (
          <ActivityIndicator
            style={styles.loadingIndicator}
            size="large"
            color="#0000ff"
          />
        )}
        <Image
          source={{
            uri:
              titleItem.Image_Tile && titleItem.Image_Tile.URL
                ? 'https:' + titleItem.Image_Tile.URL
                : '',
          }}
          resizeMode={'cover'}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          style={styles.image}
        />
        {isGamePass ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>GAME PASS</Text>
          </View>
        ) : isOwned ? (
          <View style={[styles.badge, styles.badgeOwned]}>
            <Text style={styles.badgeText}>OWNED</Text>
          </View>
        ) : null}
        <View style={styles.descriptionContainer}>
          <Text
            style={styles.description}
            numberOfLines={2}
            ellipsizeMode="tail">
            {titleItem.ProductTitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#666666',
    borderRadius: 10,
    margin: 10,
  },
  loadingIndicator: {
    position: 'absolute',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  descriptionContainer: {
    padding: 10,
  },
  description: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
    backgroundColor: '#107C10',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeOwned: {
    backgroundColor: '#595959',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});

export default TitleItem;
