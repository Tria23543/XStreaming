import React from 'react';
import {TouchableOpacity} from 'react-native';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import {SvgXml} from 'react-native-svg';
import icons from '../common/virtualgp';

type Props = {
  name: string;
  style: any;
  onPressIn: (name: string) => void;
  onPressOut: (name: string) => void;
};

const GamepadButton: React.FC<Props> = ({
  name,
  onPressIn,
  onPressOut,
  style,
}) => {
  const startedRef = React.useRef(false);
  const longPressGesture = React.useMemo(
    () =>
      Gesture.LongPress()
        .onStart(() => {
          startedRef.current = true;
          onPressIn && onPressIn(name);
        })
        .onFinalize(() => {
          // onFinalize fires after both a normal end and a cancellation, so
          // it alone covers release; binding onEnd as well would call
          // onPressOut twice for every normal release. It also fires when
          // the gesture FAILED (e.g. a tap shorter than minDuration never
          // reached onStart) — only release a button that was actually
          // pressed.
          if (startedRef.current) {
            startedRef.current = false;
            onPressOut && onPressOut(name);
          }
        })
        .minDuration(16),
    [name, onPressIn, onPressOut],
  );

  return (
    <GestureDetector gesture={longPressGesture}>
      <TouchableOpacity style={style}>
        <SvgXml xml={icons[name]} width="40" height="40" />
      </TouchableOpacity>
    </GestureDetector>
  );
};

export default GamepadButton;
