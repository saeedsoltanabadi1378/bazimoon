import { vibrate } from "./platform";
import { readLocal, writeLocal } from "./storage";

const KEY = "bazimoon-haptics";
let enabled = readLocal<boolean>(KEY, true);

export function setHapticsEnabled(value: boolean) {
  enabled = value;
  writeLocal(KEY, value);
}

export function hapticsEnabled() {
  return enabled;
}

/** Light tap on a valid move, warning on an invalid one, success on a win (see the design's app-shell notes). */
export const haptic = {
  tap() {
    if (enabled) vibrate(8);
  },
  select() {
    if (enabled) vibrate(5);
  },
  warn() {
    if (enabled) vibrate([20, 40, 20]);
  },
  error() {
    if (enabled) vibrate([30, 40, 30, 40, 30]);
  },
  success() {
    if (enabled) vibrate([10, 30, 20]);
  },
};
