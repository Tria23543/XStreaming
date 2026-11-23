import React from 'react';
import {getDefaultButtons} from '../common/gamepadDefaults';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
import GamepadButton from './CustomGamepad/GamepadButton';
import Dpad from './CustomGamepad/Dpad';
import {ReactNativeJoystick} from '../components/Joystick';
import {getSettings} from '../store/gamepadStore';
import icons from '../common/virtualgp';

type Props = {
  title: string;
  opacity: number;
  onPressIn: (name: string) => {};
  onPressOut: (name: string) => {};
  onStickMove: (id: string, position: any) => {};
};

const CustomVirtualGamepad: React.FC<Props> = ({
  title,
  opacity = 0.6,
  onPressIn,
  onPressOut,
  onStickMove,
}) => {
  const {width, height} = useWindowDimensions();

  // Computed synchronously: the load is a synchronous storage read,
  // and the old state+effect version painted one empty-overlay frame
  // on every open. useWindowDimensions also re-derives the default
  // layout when the device rotates, instead of freezing the size
  // captured at first mount.
  const buttons = React.useMemo(() => {
    const _settings = getSettings();
    const _buttons = getDefaultButtons(width, height);
    // Validate entry by entry AND field by field: a stored layout is
    // user data, and one malformed entry must not reach the renderer
    // (an unknown name has no icon, a non-numeric position or scale
    // produces NaN geometry, a duplicate name collides as a React
    // key). Bad fields are normalised where a sane default exists
    // and the entry is dropped where none does.
    const saved = _settings[title];
    const validSaved: any[] = [];
    if (Array.isArray(saved)) {
      const seen = new Set<string>();
      saved.forEach((b: any) => {
        if (!b || typeof b !== 'object' || typeof b.name !== 'string') {
          return;
        }
        if (seen.has(b.name)) {
          return;
        }
        const isSpecial =
          b.name === 'Dpad' ||
          b.name === 'LeftStick' ||
          b.name === 'RightStick';
        if (!isSpecial && !icons[b.name]) {
          return;
        }
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) {
          return;
        }
        seen.add(b.name);
        validSaved.push({
          ...b,
          scale: Number.isFinite(b.scale) && b.scale > 0 ? b.scale : 1,
          show: typeof b.show === 'boolean' ? b.show : true,
          // width/height are geometry too: a corrupt stored value
          // (a string, NaN, null) reached the D-pad's size maths
          // untouched and produced NaN or zero-size geometry.
          // Anything that is not a positive finite number becomes
          // undefined, so the renderers' own defaults apply.
          width:
            Number.isFinite(b.width) && b.width > 0 ? b.width : undefined,
          height:
            Number.isFinite(b.height) && b.height > 0 ? b.height : undefined,
        });
      });
    }
    if (validSaved.length > 0) {
      return validSaved;
    }
    // No saved layout (or an empty/corrupt one): fall back to defaults
    // instead of rendering no gamepad at all.
    return _buttons;
  }, [title, width, height]);

  // Stable identities: GamepadButton memoises its gesture object on
  // these callbacks, so fresh inline closures here would rebuild
  // every button's gesture on every render and defeat the memo.
  const handlePressIn = React.useCallback(
    (name: string) => {
      onPressIn && onPressIn(name);
    },
    [onPressIn],
  );

  const handlePressOut = React.useCallback(
    (name: string) => {
      onPressOut && onPressOut(name);
    },
    [onPressOut],
  );

  const handleStickMove = React.useCallback(
    (id: string, data: any) => {
      onStickMove && onStickMove(id, data);
    },
    [onStickMove],
  );

  // Per-stick stable handlers for the Joystick props: the inline
  // closures used before rebuilt the stick's gesture handling on
  // every render.
  const handleLeftStick = React.useCallback(
    (data: any) => handleStickMove('left', data),
    [handleStickMove],
  );

  const handleRightStick = React.useCallback(
    (data: any) => handleStickMove('right', data),
    [handleStickMove],
  );

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {buttons.map((button: any) => {
        if (button.show === false) {
          return null;
        }
        if (button.name === 'Dpad') {
          return (
            <Dpad
              key={button.name}
              scale={button.scale}
              size={button.width || 100}
              height={button.height}
              style={{
                opacity: opacity,
                left: button.x,
                top: button.y,
              }}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            />
          );
        } else if (button.name === 'LeftStick') {
          return (
            <View
              key={button.name}
              style={[
                styles.button,
                {top: button.y, left: button.x},
                {opacity},
              ]}>
              <ReactNativeJoystick
                color="#ffffff"
                radius={50}
                onMove={handleLeftStick}
                onStart={handleLeftStick}
                onStop={handleLeftStick}
              />
            </View>
          );
        } else if (button.name === 'RightStick') {
          return (
            <View
              key={button.name}
              style={[
                styles.button,
                {top: button.y, left: button.x},
                {opacity},
              ]}>
              <ReactNativeJoystick
                color="#ffffff"
                radius={50}
                onMove={handleRightStick}
                onStart={handleRightStick}
                onStop={handleRightStick}
              />
            </View>
          );
        } else {
          return (
            <GamepadButton
              key={button.name}
              name={button.name}
              scale={button.scale}
              width={button.width}
              height={button.height}
              style={[
                styles.button,
                {opacity},
                {top: button.y, left: button.x},
              ]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            />
          );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    // backgroundColor: 'rgba(255, 255, 255, 0.3)',
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 9,
  },
  button: {
    // No opacity here: every call site passes its own {opacity}, so a
    // value in the base style was always overridden and never seen.
    position: 'absolute',
  },
});

export default CustomVirtualGamepad;
