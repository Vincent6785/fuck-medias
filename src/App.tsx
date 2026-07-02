import { useEffect, useRef, useState } from 'react'
import { searchDeputes, deputeUrl, type Depute } from './api'
import './App.css'

export default function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Depute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  // Recherche avec debounce (~300 ms) + annulation des requêtes obsolètes.
  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      setSearched(false)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      try {
        const deputes = await searchDeputes(term, controller.signal)
        setResults(deputes)
        setSearched(true)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError("Impossible de contacter le service. Réessayez.")
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function openDepute(slug: string) {
    window.open(deputeUrl(slug), '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="app">
      <h1>Trouve ton député</h1>
      <p className="subtitle">
        Tape le nom de ton député pour voir son bilan de votes sur civix.fr.
      </p>

      <SearchInput value={query} onChange={setQuery} />

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
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <input
      ref={inputRef}
      className="search"
      type="search"
      placeholder="Ex. : Bazin, Dupont…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      aria-label="Nom du député"
    />
  )
}
