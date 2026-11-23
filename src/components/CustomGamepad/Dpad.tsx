import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {SvgXml} from 'react-native-svg';

type Props = {
  style?: any;
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

  // The plus outline (the cross spans 37.5%..62.5% on both axes),
  // computed in px for the pad's actual size rather than stretched
  // from a fixed viewBox, so the stroke is the constant 2px the old
  // borders drew at every size and aspect ratio. The polygon is
  // inset by half the stroke, like the inside borders it replaces.
  const outlineW = size * scale;
  const outlineH = (height !== undefined ? height : size) * scale;
  const ox1 = outlineW * 0.375;
  const ox2 = outlineW * 0.625;
  const oy1 = outlineH * 0.375;
  const oy2 = outlineH * 0.625;
  const outlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outlineW} ${outlineH}"><polygon points="${ox1 + 1},1 ${ox2 - 1},1 ${ox2 - 1},${oy1 + 1} ${outlineW - 1},${oy1 + 1} ${outlineW - 1},${oy2 - 1} ${ox2 - 1},${oy2 - 1} ${ox2 - 1},${outlineH - 1} ${ox1 + 1},${outlineH - 1} ${ox1 + 1},${oy2 - 1} 1,${oy2 - 1} 1,${oy1 + 1} ${ox1 + 1},${oy1 + 1}" fill="none" stroke="#ffffff" stroke-width="2"/></svg>`;

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
      <View style={styles.outline} pointerEvents="none">
        <SvgXml xml={outlineSvg} width="100%" height="100%" />
      </View>
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
  outline: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  button: {
    position: 'absolute',
  },
  // Touch geometry only — the visible outline is the SVG layer's.
  dpadLeft: {
    width: '50%',
    height: '25%',
    left: 0,
    top: '37.5%',
  },
  dpadTop: {
    width: '25%',
    height: '50%',
    left: '37.5%',
    top: 0,
  },
  dpadRight: {
    width: '50%',
    height: '25%',
    left: '50%',
    top: '37.5%',
  },
  dpadBottom: {
    width: '25%',
    height: '50%',
    left: '37.5%',
    top: '50%',
  },
});

export default Dpad;
