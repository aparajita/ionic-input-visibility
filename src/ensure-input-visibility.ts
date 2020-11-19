import {
  Capacitor,
  KeyboardInfo,
  PluginListenerHandle,
  Plugins,
} from '@capacitor/core';
import { TransitionOptions } from './definitions';

const { Keyboard } = Plugins;

// The current platform
const platform = Capacitor.getPlatform();

// This keeps track of whether the keyboard is showing or not, and when showing, its height
let keyboardHeight = 0;

// Keyboard event listeners
let willShowListener: PluginListenerHandle;
let willHideListener: PluginListenerHandle;

// The most recently adjusted element. We keep track of this just in case
// we get multiple keyboardShow events for the same element.
let adjustedElement: Element;

// The most recent ion-content of a focused element
let ionContent: HTMLElement;

// The current Y translation on ionContent
let translateY = 0;

// The desired gap between the top of the keyboard
// and the bottom of the focused intput element. Can be set via options.
let keyboardMargin = 8;

// Transition parameters for the ion-content when showing/hiding the keyboard
let iosShowTransition = '0.475s (0.33, 1, 0.68, 1)';
let androidShowTransition = '0.1s cubic-bezier(0.33, 1, 0.68, 1)';
let iosHideTransition = '0.1s ease-in-out';
let androidHideTransition = '0.1s ease-in-out';

// The element tags that will show a keyboard
const keyboardFocusableTags = ['input', 'textarea'];

// The input types that will show a keyboard
const keyboardFocusableTypes = [
  'date',
  'datetime',
  'datetime-local',
  'email',
  'month',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'time',
  'url',
  'week',
];

export function ensureInputVisibility(options?: TransitionOptions) {
  if (!Capacitor.isNative) {
    return;
  }

  if (!willShowListener) {
    willShowListener = Keyboard.addListener(
      'keyboardWillShow',
      keyboardWillShow,
    );
    willHideListener = Keyboard.addListener(
      'keyboardWillHide',
      keyboardWillHide,
    );

    window.addEventListener('focusin', onFocusIn);
  }

  if (options) {
    setOptions(options);
  }
}

export function removeListeners() {
  willShowListener?.remove();
  willHideListener?.remove();
  window.removeEventListener('focusin', onFocusIn);
}

export function setOptions(options: TransitionOptions) {
  if (options.margin != null) {
    keyboardMargin = options.margin;
  }

  if (options.transition) {
    iosShowTransition = options.transition;
    iosHideTransition = options.transition;
    androidShowTransition = options.transition;
    androidHideTransition = options.transition;
  }

  if (options.showTransition) {
    iosShowTransition = options.showTransition;
    androidShowTransition = options.showTransition;
  }

  if (options.iosShowTransition) {
    iosShowTransition = options.iosShowTransition;
  }

  if (options.androidShowTransition) {
    androidShowTransition = options.androidShowTransition;
  }

  if (options.hideTransition) {
    iosHideTransition = options.hideTransition;
    androidHideTransition = options.hideTransition;
  }

  if (options.iosHideTransition) {
    iosHideTransition = options.iosHideTransition;
  }

  if (options.androidHideTransition) {
    androidHideTransition = options.androidHideTransition;
  }
}

function onFocusIn(event: FocusEvent) {
  // If the keyboard is not showing yet, don't do anything, it will
  // be handled by keyboardWillShow(). In any case we need the keyboard
  // height to make any adjustments.
  if (keyboardHeight === 0) {
    return;
  }

  const element = event.target as HTMLElement;

  // Is the focused element keyboard-focusable?
  if (canShowKeyboard(element)) {
    moveElementIntoView(element, keyboardHeight);
  }
}

function canShowKeyboard(element: HTMLElement) {
  let tag = element.tagName.toLowerCase();

  if (!keyboardFocusableTags.includes(tag)) {
    return false;
  }

  // If it's an input, is its type keyboard-focusable?
  if (tag === 'input') {
    return keyboardFocusableTypes.includes(
      (element as HTMLInputElement).type.toLowerCase(),
    );
  }

  // It's a textarea
  return true;
}

function keyboardWillShow(info: KeyboardInfo) {
  // The keyboard is about to show, save its height
  const oldHeight = keyboardHeight;
  keyboardHeight = info.keyboardHeight;

  // See if anything has focus. If nothing has focus,
  // focusedElement will be null or document.body.
  const focusedElement = document.activeElement;

  // If the focused element has not already been adjusted, or if
  // it's the same element and the keyboard height changed, move it into view.
  if (focusedElement !== adjustedElement || oldHeight !== keyboardHeight) {
    moveElementIntoView(focusedElement, keyboardHeight);
  }
}

function keyboardWillHide() {
  keyboardHeight = 0;
  adjustedElement = null;
  translateY = 0;

  if (ionContent) {
    const transition =
      platform === 'ios' ? iosHideTransition : androidHideTransition;

    if (transition) {
      ionContent.style.setProperty('transition', `transform ${transition}`);
    }

    ionContent.style.removeProperty('transform');
  }
}

function moveElementIntoView(element: Element, keyboardHeight: number) {
  // Keep track of the most recently adjusted element
  adjustedElement = element;

  // Get the focused element's ion-content container
  ionContent = getIonContent(element);

  // Calculate the bottom of the element relative to the document..
  // This includes the current Y translation.
  const boundingRect = element.getBoundingClientRect();

  // Calculate the top of the keyboard
  const webviewHeight = document.body.getBoundingClientRect().height;
  const keyboardTop = webviewHeight - keyboardHeight;

  // Calculate where the bottom is relative to the keyboard top + margin
  let bottomDiff = keyboardTop - (boundingRect.bottom + keyboardMargin);

  // Check what the top of the element would be if we moved the bottom
  // into view. If moving the bottom into view would move the top above
  // the visible top of its ion-content, prefer keeping the top in view.
  const proposedTop = boundingRect.top + (bottomDiff < 0 ? bottomDiff : 0);

  // This calculates what the non-translated ion-content top is in
  // document coordinates, i.e. the visible top.
  const visibleTop = ionContent.getBoundingClientRect().top - translateY;

  let topDiff = 0;

  if (proposedTop < visibleTop) {
    // Okay, the proposed top is above the visible top, so we need to
    // translate the content so it is within its ion-content..
    topDiff = visibleTop + keyboardMargin - boundingRect.top;
  }

  if (topDiff > 0 || bottomDiff < 0) {
    // Prefer keeping the top in view
    const diff = topDiff > 0 ? topDiff : bottomDiff;
    translateY = diff + translateY;

    const transition =
      platform === 'ios' ? iosShowTransition : androidShowTransition;

    if (transition) {
      ionContent.style.setProperty('transition', `transform ${transition}`);
    } else {
      ionContent.style.removeProperty('transition');
    }

    ionContent.style.setProperty('transform', `translateY(${translateY}px)`);
  }
}

export function getIonContent(element: Element): HTMLElement | null {
  // Find the nearest parent ion-content
  while (element) {
    if (element.tagName === 'ION-CONTENT') {
      return element as HTMLElement;
    }

    element = element.parentElement;
  }

  return null;
}
