import { useEffect, useId, useRef, useState } from 'react'
import {
  API_RESULT_CAP,
  ApiError,
  searchDeputes,
  deputeUrl,
  type Depute,
} from './api'
import './App.css'

function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    // L'API limite à 60 requêtes/minute (en-tête x-ratelimit-limit).
    return 'Trop de recherches d’un coup. Patientez quelques secondes.'
  }
  return 'Impossible de contacter le service. Réessayez.'
}

export default function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Depute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  // Les transitions synchrones vivent ici plutôt que dans le corps de l'effet,
  // où elles provoqueraient des rendus en cascade (react-hooks/set-state-in-effect).
  function handleQueryChange(next: string) {
    setQuery(next)
    if (next.trim()) {
      setLoading(true)
      setError(null)
    } else {
      setResults([])
      setSearched(false)
      setError(null)
      setLoading(false)
    }
  }

  // Recherche avec debounce (~300 ms) + annulation des requêtes obsolètes.
  useEffect(() => {
    const term = query.trim()
    if (!term) return

    const controller = new AbortController()

    const timer = setTimeout(async () => {
      try {
        const deputes = await searchDeputes(term, controller.signal)
        if (controller.signal.aborted) return
        setResults(deputes)
        setSearched(true)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Recherche de député échouée :', err)
        // Les résultats précédents ne correspondent plus à la requête affichée.
        setResults([])
        setSearched(false)
        setError(errorMessage(err))
      } finally {
        // Requête remplacée par une plus récente : l'effet suivant a déjà remis
        // `loading` à true, on n'y touche pas.
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function openDepute(slug: string) {
    // NB : avec `noopener`, window.open renvoie null même en cas de succès
    // (spec HTML) — on ne peut donc pas en déduire un blocage de pop-up.
    window.open(deputeUrl(slug), '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="app">
      <h1>Trouve ton député</h1>
      <p className="subtitle">
        Tape le nom de ton député pour voir son bilan de votes sur civix.fr.
      </p>

      <SearchInput value={query} onChange={handleQueryChange} />

      <section className="results" aria-live="polite">
        {loading && <p className="hint">Recherche…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && searched && results.length === 0 && (
          <p className="hint">Aucun député trouvé pour « {query.trim()} ».</p>
        )}
        {results.map((d) => (
          <button
            key={d.uid}
            className="result"
            onClick={() => openDepute(d.slug)}
          >
            <span className="result-name">
              {d.prenom} {d.nom}
            </span>
            <span className="result-meta">
              {[d.groupe, d.departement].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
        {!loading && !error && results.length === API_RESULT_CAP && (
          <p className="hint">
            L’API ne renvoie que {API_RESULT_CAP} députés au maximum : précisez
            votre recherche si le vôtre n’apparaît pas.
          </p>
        )}
      </section>

      <footer className="footer">
        Données publiques de l'Assemblée nationale, via{' '}
        <a href="https://www.civix.fr" target="_blank" rel="noopener noreferrer">
          civix.fr
        </a>
        .
      </footer>
    </main>
  )
}

function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <>
      <label className="visually-hidden" htmlFor={inputId}>
        Nom du député
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className="search"
        type="search"
        placeholder="Ex. : Bazin, Dupont…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={100}
        autoComplete="off"
      />
    </>
  )
}
