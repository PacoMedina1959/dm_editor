import { createContext, useCallback, useContext, useState } from 'react'
import es from './es.json'
import en from './en.json'

const TRANSLATIONS = { es, en }
const SUPPORTED = Object.keys(TRANSLATIONS)
const STORAGE_KEY = 'dm_editor_ui_lang'

function getInitialLang(defaultLang = 'es') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED.includes(saved)) return saved
  } catch {
    /* localStorage no disponible */
  }
  return SUPPORTED.includes(defaultLang) ? defaultLang : 'es'
}

const LanguageContext = createContext(null)

export function LanguageProvider({ defaultLang = 'es', children }) {
  const [lang, setLangState] = useState(() => getInitialLang(defaultLang))

  const setLang = useCallback((newLang) => {
    if (!SUPPORTED.includes(newLang)) return
    setLangState(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
    } catch {
      /* noop */
    }
  }, [])

  const t = useCallback((key, params) => {
    let s = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.es?.[key] ?? key
    if (params && typeof s === 'string') {
      for (const [k, v] of Object.entries(params)) {
        s = s.split(`{${k}}`).join(String(v))
      }
    }
    return s
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, supported: SUPPORTED }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useT() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useT debe usarse dentro de LanguageProvider')
  return ctx
}
