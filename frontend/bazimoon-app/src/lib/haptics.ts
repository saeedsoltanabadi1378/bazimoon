import { telegram } from "./telegram";
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
    if (enabled) telegram.HapticFeedback?.impactOccurred("light");
  },
  select() {
    if (enabled) telegram.HapticFeedback?.selectionChanged();
  },
  warn() {
    if (enabled) telegram.HapticFeedback?.notificationOccurred("warning");
  },
  error() {
    if (enabled) telegram.HapticFeedback?.notificationOccurred("error");
  },
  success() {
    if (enabled) telegram.HapticFeedback?.notificationOccurred("success");
  },
};
