/**
 * Utility functions for handling image URLs
 */

/**
 * Get the full image URL, handling both relative and absolute URLs
 * @param imageUrl - The image URL from the API (can be relative or absolute)
 * @param baseUrl - The base URL to prepend for relative URLs
 * @returns The full image URL
 */
export const getImageUrl = (imageUrl: string, baseUrl?: string): string => {
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
 * @param imageUrl - The image URL to check
 * @returns True if the URL is absolute, false otherwise
 */
export const isAbsoluteUrl = (imageUrl: string): boolean => {
  return imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
};