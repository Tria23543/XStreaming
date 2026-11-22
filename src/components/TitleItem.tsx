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

// Which badge a title gets, decided from the data that actually separates
// titles for THIS user:
// - The user's own entitled titles (from their signed-in titles list) carry
//   `details`; titles merged in from the public catalog only do not.
// - details.programs containing BYOG marks a game the user owns
//   ("Stream your own game").
// - An entitled title that is not owned and is not flagged free-to-play
//   (F2P in the catalog offerings, e.g. Fortnite) is playable through the
//   user's Game Pass subscription: "Included with Game Pass".
// The public catalog's GPULTIMATE offering tag is deliberately NOT used:
// in Microsoft's live catalog every cloud title carries it, including
// free-to-play and purchase-only games (verified against the live catalog).
export function getTitleBadge(titleItem: any): 'GP' | 'OWNED' | null {
  if (!titleItem) {
    return null;
  }
  const programs =
    (titleItem.details && titleItem.details.programs) || [];
  const isOwned =
    !titleItem.XCloudTitleId && programs.indexOf('BYOG') > -1;
  if (isOwned) {
    return 'OWNED';
  }
  if (!titleItem.details) {
    return null;
  }
  const offerings = titleItem.XCloudOfferings;
  if (offerings) {
    let isF2P = false;
    Object.keys(offerings).forEach(key => {
      const offering = offerings[key];
      if (
        offering &&
        offering.Programs &&
        offering.Programs.indexOf('F2P') > -1
      ) {
        isF2P = true;
      }
    });
    if (isF2P) {
      return null;
    }
  }
  return 'GP';
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
