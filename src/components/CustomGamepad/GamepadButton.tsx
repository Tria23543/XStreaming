// Re-export of the single shared implementation (components/
// GamepadButton): this file used to hold a near-identical duplicate
// that differed only in its width/height/scale props, and every fix
// had to be made twice. The shared component carries those props now.
import GamepadButton from '../GamepadButton';

export default GamepadButton;
