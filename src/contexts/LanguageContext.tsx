import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { LanguageCode, LanguagePrefs } from '../types';

interface LanguageContextType {
  prefs: LanguagePrefs;
  setPrefs: (next: Partial<LanguagePrefs>) => void;
  isEnabled: (lang: LanguageCode) => boolean;
}

const DEFAULT_PREFS: LanguagePrefs = { en: true, 'zh-HK': true, ko: true };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<LanguagePrefs>(DEFAULT_PREFS);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/v1/settings');
        if (res.ok && mounted) {
          const data = await res.json();
          if (data && data.languagePrefs) {
            setPrefsState({ ...DEFAULT_PREFS, ...data.languagePrefs });
          }
        }
      } catch (err) {
        console.error('Failed to load language preferences:', err);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const setPrefs = useCallback(
    (next: Partial<LanguagePrefs>) => {
      setPrefsState(prev => {
        const updated = { ...prev, ...next };
        fetch('/api/v1/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ languagePrefs: updated }),
        }).catch(err => console.error('Failed to save language preferences:', err));
        return updated;
      });
    },
    [],
  );

  const isEnabled = useCallback(
    (lang: LanguageCode) => prefs[lang] ?? true,
    [prefs],
  );

  return (
    <LanguageContext.Provider value={{ prefs, setPrefs, isEnabled }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
};
