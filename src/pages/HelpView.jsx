import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useT } from '../i18n/LanguageContext.jsx'
import { getEditorHelpUrl } from '../utils/editorHelpUrl.js'
import {
  extractTocFromMd,
  preprocessGuideMd,
  slugifyTitle,
} from '../utils/guideMarkdown.js'
import '../help.css'

function plainFromChildren(children) {
  if (children == null) return ''
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) {
    return children.map(plainFromChildren).join('')
  }
  if (typeof children === 'object' && children.props?.children != null) {
    return plainFromChildren(children.props.children)
  }
  return ''
}

function HelpH2({ children, ...rest }) {
  const id = slugifyTitle(plainFromChildren(children))
  return (
    <h2 id={id} {...rest}>
      {children}
    </h2>
  )
}

const markdownComponents = {
  h2: HelpH2,
}

/** Montado con `key={lang}` para reiniciar estado al cambiar idioma sin setState síncrono en el effect. */
function HelpViewBody() {
  const { lang, setLang, supported, t } = useT()
  const navigate = useNavigate()
  const [rawMd, setRawMd] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [fetchDone, setFetchDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const url = getEditorHelpUrl(lang)
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.text()
      })
      .then((text) => {
        if (cancelled) return
        setRawMd(text)
        setLoadError(null)
        setFetchDone(true)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(t('help.load_error'))
        setFetchDone(true)
      })
    return () => {
      cancelled = true
    }
  }, [lang, t])

  const md = useMemo(() => preprocessGuideMd(rawMd), [rawMd])
  const toc = useMemo(() => extractTocFromMd(md), [md])
  const loading = !fetchDone

  const goBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/aventura')
  }, [navigate])

  const scrollToId = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const prev = document.title
    document.title = `${t('help.doc_title')} — DM Editor`
    return () => {
      document.title = prev
    }
  }, [t])

  return (
    <div className="help-page">
      <header className="help-header">
        <button type="button" className="btn-help-back" onClick={goBack}>
          {t('help.back')}
        </button>
        <span className="help-header-label">{t('help.role_guide')}</span>
        <div className="help-header-actions">
          <select
            className="lang-selector"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            title={t('lang.label')}
            aria-label={t('lang.label')}
          >
            {supported.map((l) => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="help-layout">
        <nav className="help-sidebar" aria-label={t('help.toc_title')}>
          <div className="help-sidebar-title">{t('help.toc_title')}</div>
          {toc.length > 0 ? (
            <ol className="help-toc">
              {toc.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="help-toc-link"
                    onClick={() => scrollToId(item.id)}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            !loading && <p className="help-sidebar-empty">{t('help.toc_empty')}</p>
          )}
        </nav>

        <article className="help-content prose-help">
          {loading && <p className="help-status">{t('help.loading')}</p>}
          {loadError && <p className="help-error" role="alert">{loadError}</p>}
          {!loading && !loadError && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={markdownComponents}
            >
              {md}
            </ReactMarkdown>
          )}
        </article>
      </div>
    </div>
  )
}

export default function HelpView() {
  const { lang } = useT()
  return <HelpViewBody key={lang} />
}
