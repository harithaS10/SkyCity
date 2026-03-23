/**
 * Utility functions for handling image URLs
 */

/**
 * Get the full image URL, handling both relative and absolute URLs
 * @param {string} imageUrl - The image URL from the API (can be relative or absolute)
 * @param {string} baseUrl - The base URL to prepend for relative URLs
 * @returns {string} The full image URL
 */
export const getImageUrl = (imageUrl, baseUrl) => {
  if (!imageUrl) return '';
  
  // If the URL already starts with http/https, return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // For relative URLs, prepend the base URL
  const base = baseUrl || import.meta.env.VITE_API_BASE_URL || 'https://www.vivifysoft.in/VivifyReports';
  return `${base}${imageUrl}`;
};

/**
 * Check if an image URL is absolute (starts with http/https)
 * @param {string} imageUrl - The image URL to check
 * @returns {boolean} True if the URL is absolute, false otherwise
 */
export const isAbsoluteUrl = (imageUrl) => {
  return imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
};