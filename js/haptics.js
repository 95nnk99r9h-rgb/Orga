// A short haptic tick. Android has the Vibration API. Safari on iOS has no
// web API for this, but since iOS 18 it plays the system haptic whenever a
// switch-style checkbox is toggled – so a hidden one is toggled instead.

let toggle = null;

function hiddenSwitch() {
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.append(input);
  document.body.append(label);
  return { label, input };
}

export function haptic() {
  if ('vibrate' in navigator && !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    navigator.vibrate(12);
    return;
  }
  toggle ??= hiddenSwitch();
  toggle.label.click();
  if (document.activeElement === toggle.input) toggle.input.blur();
}
