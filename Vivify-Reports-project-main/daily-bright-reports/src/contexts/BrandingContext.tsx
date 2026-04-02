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
      root.style.setProperty('--brand-primary', themeColor);
      const rgb = hexToRgb(themeColor);
      if (rgb) {
        root.style.setProperty('--brand-primary-rgb', rgb);
      }
      previousColor.current = themeColor;
    }

    // Reset to default if user logs out or branding is cleared
    if (!themeColor && previousColor.current) {
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-primary-rgb');
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
