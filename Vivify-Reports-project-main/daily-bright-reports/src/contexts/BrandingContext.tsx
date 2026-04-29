import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

interface BrandingContextType {
  companyName: string;
  logoUrl: string | undefined;
  themeColor: string | undefined;
}

const BrandingContext = createContext<BrandingContextType>({
  companyName: 'SkyCity',
  logoUrl: undefined,
  themeColor: undefined,
});

/** Converts a hex colour to space‑separated RGB components for Tailwind opacity utilities */
function hexToRgb(hex: string): string | null {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : null;
}

/** Converts hex to HSL string for CSS custom properties (e.g. "174 72% 35%") */
function hexToHsl(hex: string): string | null {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const BrandingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const previousColor = useRef<string | undefined>(undefined);

  const companyName = user?.companyName || 'SkyCity';
  const logoUrl = user?.logoUrl;
  const themeColor = user?.themeColor;

  // Inject/remove CSS custom property whenever themeColor changes
  useEffect(() => {
    const root = document.documentElement;

    if (themeColor && themeColor !== previousColor.current) {
      // Set --brand-primary (hex) for direct style usage
      root.style.setProperty('--brand-primary', themeColor);

      // Set --primary (HSL) so ALL Tailwind bg-primary / text-primary / border-primary classes update
      const hsl = hexToHsl(themeColor);
      if (hsl) {
        root.style.setProperty('--primary', hsl);
        root.style.setProperty('--ring', hsl);
        root.style.setProperty('--sidebar-primary', hsl);
        root.style.setProperty('--chart-1', hsl);
      }

      // Set RGB for opacity utilities
      const rgb = hexToRgb(themeColor);
      if (rgb) {
        root.style.setProperty('--brand-primary-rgb', rgb);
      }

      // Cache in localStorage so index.html script can apply it on next load (no flash)
      try { localStorage.setItem('skycity_theme_color', themeColor); } catch { /* ignore */ }

      previousColor.current = themeColor;
    }

    // Reset to default teal if user logs out or branding is cleared
    if (!themeColor && previousColor.current) {
      root.style.setProperty('--primary', '174 72% 35%');
      root.style.setProperty('--ring', '174 72% 35%');
      root.style.setProperty('--sidebar-primary', '174 72% 35%');
      root.style.setProperty('--chart-1', '174 72% 35%');
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-primary-rgb');
      try { localStorage.removeItem('skycity_theme_color'); } catch { /* ignore */ }
      previousColor.current = undefined;
    }
  }, [themeColor]);

  return (
    <BrandingContext.Provider value={{ companyName, logoUrl, themeColor }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
