import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type ContentLang = 'zh-HK' | 'zh-CN' | 'ko' | 'en';

function toPrefLang(lang: ContentLang): 'en' | 'zh-HK' | 'ko' {
  if (lang === 'zh-CN') return 'zh-HK';
  return lang as 'en' | 'zh-HK' | 'ko';
}

interface TranslatedTextProps {
  original: string;
  translation?: string;
  originalLang: ContentLang;
  className?: string;
  translationClassName?: string;
}

export function TranslatedText({
  original,
  translation,
  originalLang,
  className,
  translationClassName,
}: TranslatedTextProps) {
  const { isEnabled } = useLanguage();

  const prefLang = toPrefLang(originalLang);
  const showOriginal = originalLang === 'en' || isEnabled(prefLang);
  const showTranslation =
    isEnabled('en') && !!translation && originalLang !== 'en' && showOriginal;

  if (!showOriginal && !showTranslation) {
    return null;
  }

  return (
    <>
      {showOriginal && <p className={className}>{original}</p>}
      {showTranslation && (
        <p
          className={
            translationClassName ||
            'text-xs text-slate-500 dark:text-slate-400 italic mt-1 leading-relaxed'
          }
        >
          {translation}
        </p>
      )}
    </>
  );
}
