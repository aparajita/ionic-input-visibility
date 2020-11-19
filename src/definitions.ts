export interface TransitionOptions {
  // The margin in px you want between the bottom of the input
  // and the top of the keyboard. Default: 8px
  margin?: number;

  /*
   * Transitions
   *
   * All of the transition options should be strings in the format
   * used with the CSS 'transition' property, excluding the property name.
   * See https://developer.mozilla.org/en-US/docs/Web/CSS/transition#Syntax
   * for details on the syntax.
   */

  /**
   * Sets the same transition for show/hide on both platforms.
   * Default: undefined
   */
  transition?: string;

  /**
   * Sets the show transition for both platforms. Overrides 'transition'
   * for keyboard show transitions. Default: undefined
   */
  showTransition?: string;

  /**
   * Sets the show transition for iOS. Overrides 'transition' and
   * 'showTransition' for keyboard show transitions. Default: undefined
   */
  iosShowTransition?: string;

  /**
   * Sets the show transition for Android. Overrides 'transition' and
   * 'showTransition' for keyboard show transitions. Default: undefined
   */
  androidShowTransition?: string;

  /**
   * Sets the hide transition for both platforms. Overrides 'transition'
   * for keyboard hide transitions. Default: undefined
   */
  hideTransition?: string;

  /**
   * Sets the hide transition for iOS. Overrides 'transition' and
   * 'hideTransition'for keyboard hide transitions. Default: undefined
   */
  iosHideTransition?: string;

  /**
   * Sets the hide transition for Android. Overrides 'transition' and
   * 'hideTransition'. Default: undefined
   */
  androidHideTransition?: string;
}
