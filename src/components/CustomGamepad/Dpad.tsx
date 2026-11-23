import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';

type Props = {
  style: any;
  scale?: number;
  size?: number;
  height?: number;
  onPressIn: any;
  onPressOut: any;
};

const Dpad: React.FC<Props> = ({
  style = {},
  scale = 1,
  size = 100,
  height,
  onPressIn,
  onPressOut,
}) => {
  const handlePressIn = (name: string) => {
    onPressIn && onPressIn(name);
  };

  const handlePressOut = (name: string) => {
    onPressOut && onPressOut(name);
  };

  return (
    <View
      style={[
        styles.dpad,
        // Size the container by the scale instead of transforming it:
        // a centre-anchored transform made the in-game pad sit up-left
        // of where the layout editor's top-left-anchored preview showed
        // it. Percentage geometry below scales with the container.
        // Layouts store width and height separately; the height
        // used to be ignored and the pad always rendered square.
        {
          width: size * scale,
          height: (height !== undefined ? height : size) * scale,
        },
        style,
      ]}>
      <TouchableOpacity
        style={[styles.button, styles.dpadLeft]}
        onPressIn={() => {
          handlePressIn('DPadLeft');
        }}
        onPressOut={() => {
          handlePressOut('DPadLeft');
        }}
      />
      <TouchableOpacity
        style={[styles.button, styles.dpadTop]}
        onPressIn={() => {
          handlePressIn('DPadUp');
        }}
        onPressOut={() => {
          handlePressOut('DPadUp');
        }}
      />
      <TouchableOpacity
        style={[styles.button, styles.dpadRight]}
        onPressIn={() => {
          handlePressIn('DPadRight');
        }}
        onPressOut={() => {
          handlePressOut('DPadRight');
        }}
      />
      <TouchableOpacity
        style={[styles.button, styles.dpadBottom]}
        onPressIn={() => {
          handlePressIn('DPadDown');
        }}
        onPressOut={() => {
          handlePressOut('DPadDown');
        }}
      />
    </View>
  );
};

// Segment geometry is percentage-based so the cross fills whatever size
// the layout assigns (layouts define the D-pad as 100x100 by default):
// arms are 50% long and 25% thick, starting at 37.5% offsets, so
// opposite arms meet exactly at the centre. They used to be 37.5%
// long, which left the centre 25%x25% square covered by no segment —
// a press aimed between directions registered nothing. Where the arm
// ends overlap in the centre, the later-rendered segment takes the
// press. Every part of the cross stays inside the container, visible
// and tappable exactly where it is drawn.
const styles = StyleSheet.create({
  dpad: {
    position: 'absolute',
  },
  button: {
    position: 'absolute',
  },
  dpadLeft: {
    width: '50%',
    height: '25%',
    borderWidth: 2,
    borderColor: '#fff',
    left: 0,
    top: '37.5%',
    borderRightWidth: 0,
  },
  dpadTop: {
    width: '25%',
    height: '50%',
    borderWidth: 2,
    borderColor: '#fff',
    left: '37.5%',
    top: 0,
    borderBottomWidth: 0,
  },
  dpadRight: {
    width: '50%',
    height: '25%',
    borderWidth: 2,
    borderColor: '#fff',
    left: '50%',
    top: '37.5%',
    borderLeftWidth: 0,
  },
  dpadBottom: {
    width: '25%',
    height: '50%',
    borderWidth: 2,
    borderColor: '#fff',
    left: '37.5%',
    top: '50%',
    borderTopWidth: 0,
  },
});

export default Dpad;
