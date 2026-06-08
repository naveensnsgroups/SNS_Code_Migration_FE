// Type declaration for file-icons-js (same as used by Eclipse Theia/snside)
// Source: snside/packages/core/src/browser/file-icons-js.d.ts

declare module 'file-icons-js' {
  /**
   * Returns the CSS class name for the icon for the given file path/name.
   * Example: getClass('file.js') => 'js-icon'
   */
  function getClass(filePath: string): string;

  /**
   * Returns the CSS class name including color class for the given file path/name.
   * Example: getClassWithColor('file.js') => 'js-icon medium-yellow'
   * This is the function used by Theia's DefaultUriLabelProviderContribution.
   */
  function getClassWithColor(filePath: string): string;
}
