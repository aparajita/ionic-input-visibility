import { Capacitor, KeyboardInfo, PluginListenerHandle, Plugins } from '@capacitor/core'
import { ScrollOptions } from './definitions'
import { Content } from '@ionic/core/dist/types/components/content/content'
import animateScrollTo from 'animated-scroll-to'

type SelectableElement = HTMLInputElement | HTMLTextAreaElement

const { Keyboard } = Plugins

// This keeps track of whether the keyboard is showing or not, and when showing, its height
let keyboardHeight = 0

// Keyboard event listeners
let willShowListener: PluginListenerHandle
let didHideListener: PluginListenerHandle

// The most recently adjusted element. We keep track of this just in case
// we get multiple keyboardShow events for the same element.
let adjustedElement: HTMLElement

// The most recent ion-content of a focused element
let ionContent: HTMLElement

// The current scroll on ionContent
let scroll = 0

// The desired gap between the top of the keyboard
// and the bottom of the focused intput element. Can be set via options.
let keyboardMargin = 16

// The element tags that will show a keyboard
const keyboardFocusableTags = ['input', 'textarea']

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
  'week'
]

// How long we want the animation to last in ms
const animationDuration = 250

export function ensureInputVisibility(options?: ScrollOptions) {
  if (!Capacitor.isNative) {
    return
  }

  if (!willShowListener) {
    willShowListener = Keyboard.addListener('keyboardWillShow', keyboardWillShow)
    didHideListener = Keyboard.addListener('keyboardDidHide', keyboardDidHide)

    window.addEventListener('focusin', onFocusIn)
  }

  if (options) {
    setOptions(options)
  }
}

export function removeInputListeners() {
  willShowListener?.remove()
  didHideListener?.remove()
  window.removeEventListener('focusin', onFocusIn)
}

export function setOptions(options: ScrollOptions) {
  if (options.margin != null) {
    keyboardMargin = options.margin
  }
}

function onFocusIn(event: FocusEvent) {
  // If the keyboard is not showing yet, don't do anything, it will
  // be handled by keyboardWillShow(). In any case we need the keyboard
  // height to make any adjustments.
  if (keyboardHeight === 0) {
    return
  }

  const element = event.target as HTMLElement

  // Is the focused element keyboard-focusable?
  if (canShowKeyboard(element)) {
    scrollElementIntoView(element, keyboardHeight)
  }
}

function canShowKeyboard(element: HTMLElement) {
  let tag = element.tagName.toLowerCase()

  if (!keyboardFocusableTags.includes(tag)) {
    return false
  }

  // If it's an input, is its type keyboard-focusable?
  if (tag === 'input') {
    return keyboardFocusableTypes.includes((element as HTMLInputElement).type.toLowerCase())
  }

  // It's a textarea
  return true
}

function keyboardWillShow(info: KeyboardInfo) {
  // The keyboard is about to show, save its height
  const oldHeight = keyboardHeight
  keyboardHeight = info.keyboardHeight

  // See if anything has focus. If nothing has focus,
  // focusedElement will be null or document.body.
  const focusedElement = document.activeElement as HTMLElement

  // If the focused element has not already been adjusted, or if
  // it's the same element and the keyboard height changed, move it into view.
  if (focusedElement !== adjustedElement || oldHeight !== keyboardHeight) {
    scrollElementIntoView(focusedElement, keyboardHeight)
  }
}

function keyboardDidHide() {
  // On Android, the focused element is not blurring as it should
  adjustedElement.blur()

  keyboardHeight = 0
  adjustedElement = null
  scroll = 0

  // Content is scrolled by Ionic
}

function scrollElementIntoView(element: HTMLElement, keyboardHeight: number) {
  // On some Android versions, it seems Chrome is doing scrolling.
  // Rather than compete with that, we'll wait 500 ms and see if
  // the input is in view. If so, we're done. If not, scroll.
  const delay = Capacitor.getPlatform() === 'ios' ? 0 : 500

  setTimeout(() => {
    // Keep track of the most recently adjusted element
    adjustedElement = element

    // Get the focused element's ion-content container
    ionContent = getIonContent(element)

    // Calculate the bottom of the element relative to the document..
    // This includes the current Y translation.
    const boundingRect = element.getBoundingClientRect()

    // Calculate the top of the keyboard
    const webviewHeight = document.body.getBoundingClientRect().height
    const keyboardTop = webviewHeight - keyboardHeight

    // Calculate where the bottom is relative to the keyboard top + margin
    let bottomDiff = keyboardTop - (boundingRect.bottom + keyboardMargin)

    // Check what the top of the element would be if we moved the bottom
    // into view. If moving the bottom into view would move the top above
    // the visible top of its ion-content, prefer keeping the top in view.
    const proposedTop = boundingRect.top + (bottomDiff < 0 ? bottomDiff : 0)

    // This calculates what the non-translated ion-content top is in
    // document coordinates, i.e. the visible top.
    const visibleTop = ionContent.getBoundingClientRect().top - scroll

    let topDiff = 0

    if (proposedTop < visibleTop) {
      // Okay, the proposed top is above the visible top, so we need to
      // translate the content so it is within its ion-content..
      topDiff = visibleTop + keyboardMargin - boundingRect.top
    }

    if (topDiff > 0 || bottomDiff < 0) {
      // Prefer keeping the top in view
      const diff = topDiff > 0 ? topDiff : bottomDiff
      scroll = diff + scroll
      scrollContentTo(-scroll)
    }
  }, delay)
}

function scrollContentTo(top: number) {
  // On iOS, how long we wait (in ms) after keyboard show to animate into view.
  // Ionic is doing something before this, if we don't wait
  // the animation doesn't work.
  const animationDelay = 500

  // TODO: With ionic/vue 0.0.9, we can't use HTMLIonContentElement,
  // but we can use Content, so do that.
  const temp = ionContent as unknown
  const content = temp as Content
  content.getScrollElement().then((scrollElement) => {
    if (scrollElement) {
      if (Capacitor.getPlatform() === 'ios') {
        // We have to wait until something else is done messing with
        // scrollTop before we can reliably change it.
        setTimeout(() => {
          animateScrollTo(top, {
            elementToScroll: scrollElement,

            // Maximum duration of the scroll animation
            maxDuration: animationDuration,

            // Minimum duration of the scroll animation
            minDuration: animationDuration,

            // Duration of the scroll per 1000px
            speed: 500
          }).then(() => {
            // The caret is not scrolling with the element in some cases,
            // this forces it back into the element.
            if (adjustedElement) {
              adjustedElement.focus()

              if (/^INPUT|TEXTAREA$/.test(adjustedElement.tagName)) {
                const input = adjustedElement as SelectableElement
                input.setSelectionRange(input.selectionStart, input.selectionEnd)
              }
            }
          })
        }, animationDelay)
      } else {
        // On Android, just move the element directly, we've already waited 500 ms
        scrollElement.scrollTop = top
      }
    }
  })
}

export function getIonContent(element: Element): HTMLElement | null {
  // Find the nearest parent ion-content
  while (element) {
    if (element.tagName === 'ION-CONTENT') {
      return element as HTMLElement
    }

    element = element.parentElement
  }

  return null
}
