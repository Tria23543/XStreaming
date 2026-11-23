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

// Which badge a title gets. The /v2/titles response is NOT an entitlement
// list: it returns the whole cloud catalog with per-user flags on every
// entry (this is why counting titles that merely have `details` gave
// 2,812). The per-user truth is carried on each entry's `details` object:
// - `details.programs` containing BYOG (and no XCloudTitleId) marks a game
//   the user owns ("Stream your own game") — the app's original rule.
// - `details.isFreeInStore` marks a free-to-play game (e.g. Fortnite):
//   playable by everyone, not "included with a subscription".
// - `details.hasEntitlement` is Microsoft's own per-user flag for "this
//   user can play this title" — the same flag the Xbox website's
//   "Included in your subscription" state is based on, and the filter
//   other clients (e.g. Greenlight) use for their Game Pass library.
// A title with none of these needs to be purchased before it can stream.
export function getTitleBadge(
  titleItem: any,
): 'GP' | 'OWNED' | 'FREE' | null {
  if (!titleItem || !titleItem.details) {
    return null;
  }
  const programs = titleItem.details.programs || [];
  const isOwned =
    !titleItem.XCloudTitleId && programs.indexOf('BYOG') > -1;
  if (isOwned) {
    return 'OWNED';
  }
  if (titleItem.details.isFreeInStore) {
    return 'FREE';
  }
  if (titleItem.details.hasEntitlement) {
    return 'GP';
  }
  return null;
}

// Whether the signed-in user can actually stream this title right now.
export function isEntitled(titleItem: any): boolean {
  return getTitleBadge(titleItem) !== null;
}

const TitleItem: React.FC<Props> = ({titleItem, onPress}) => {
  const [loading, setLoading] = React.useState(true);

  const badge = getTitleBadge(titleItem);

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
        {badge === 'GP' ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>GAME PASS</Text>
          </View>
        ) : badge === 'OWNED' ? (
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
