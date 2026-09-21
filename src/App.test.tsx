import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ApiError, type Depute } from './api'

// La couche API est mockée, mais `importOriginal` préserve ApiError et
// API_RESULT_CAP : sans cela le composant les recevrait à `undefined`.
const { searchDeputes, deputeUrl } = vi.hoisted(() => ({
  searchDeputes: vi.fn(),
  deputeUrl: vi.fn((slug: string) => `https://civix.test/${slug}`),
}))

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  searchDeputes,
  deputeUrl,
}))

const DUPONT: Depute = {
  uid: 'PA1',
  prenom: 'Jean',
  nom: 'Dupont',
  groupe: 'REN',
  departement: 'Paris',
  slug: 'jean-dupont',
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText('Nom du député'), {
    target: { value },
  })
}

beforeEach(() => {
  searchDeputes.mockReset()
  deputeUrl.mockClear()
  // Le composant journalise les échecs : on évite d'en polluer la sortie.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  // Sans restoreAllMocks, le spy sur window.open fuirait sur les tests suivants.
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('<App />', () => {
  it('affiche le titre et un champ de recherche auto-focus, sans résultat initial', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Trouve ton député' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nom du député')).toHaveFocus()
    expect(searchDeputes).not.toHaveBeenCalled()
  })

  it('déclenche une seule recherche debouncée après ~300 ms', async () => {
    vi.useFakeTimers()
    searchDeputes.mockResolvedValue([])
    render(<App />)

    type('D')
    type('Du')
    type('Dup')
    expect(searchDeputes).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(searchDeputes).toHaveBeenCalledTimes(1)
    expect(searchDeputes).toHaveBeenCalledWith('Dup', expect.any(AbortSignal))
  })

  it('affiche l’indicateur de chargement pendant la requête', async () => {
    // Promesse jamais résolue : la recherche reste « en vol ».
    searchDeputes.mockReturnValue(new Promise<Depute[]>(() => {}))
    render(<App />)

    type('dupont')

    expect(await screen.findByText('Recherche…')).toBeInTheDocument()
  })

  it('affiche les résultats avec la ligne meta jointe', async () => {
    searchDeputes.mockResolvedValue([DUPONT])
    render(<App />)

    type('dupont')

    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument()
    expect(screen.getByText('REN · Paris')).toBeInTheDocument()
    expect(screen.getByText('Jean Dupont').closest('[aria-live]')).not.toBeNull()
  })

  it('omet les champs vides de la ligne meta', async () => {
    searchDeputes.mockResolvedValue([{ ...DUPONT, departement: '' }])
    render(<App />)

    type('dupont')

    expect(await screen.findByText('REN')).toBeInTheDocument()
    expect(screen.queryByText('REN · ')).not.toBeInTheDocument()
  })

  it('ouvre la page du député dans un nouvel onglet au clic', async () => {
    searchDeputes.mockResolvedValue([DUPONT])
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<App />)

    type('dupont')
    fireEvent.click(await screen.findByText('Jean Dupont'))

    expect(deputeUrl).toHaveBeenCalledWith('jean-dupont')
    expect(openSpy).toHaveBeenCalledWith(
      'https://civix.test/jean-dupont',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('affiche un message d’erreur générique quand l’API échoue', async () => {
    searchDeputes.mockRejectedValue(new Error('boom'))
    render(<App />)

    type('dupont')

    expect(
      await screen.findByText(/Impossible de contacter le service/),
    ).toBeInTheDocument()
  })

  it('distingue le dépassement de quota (429) d’une panne réseau', async () => {
    searchDeputes.mockRejectedValue(new ApiError(429))
    render(<App />)

    type('dupont')

    expect(await screen.findByText(/Trop de recherches/)).toBeInTheDocument()
    expect(
      screen.queryByText(/Impossible de contacter le service/),
    ).not.toBeInTheDocument()
  })

  it('efface les résultats précédents quand la recherche suivante échoue', async () => {
    // Régression : l'échec laissait la liste précédente sous le message d'erreur.
    searchDeputes.mockResolvedValueOnce([DUPONT])
    render(<App />)

    type('dupont')
    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument()

    searchDeputes.mockRejectedValueOnce(new Error('boom'))
    type('dupon')

    expect(
      await screen.findByText(/Impossible de contacter le service/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument()
  })

  it('efface l’erreur dès qu’une nouvelle recherche aboutit', async () => {
    searchDeputes.mockRejectedValueOnce(new Error('boom'))
    render(<App />)

    type('dupont')
    expect(
      await screen.findByText(/Impossible de contacter le service/),
    ).toBeInTheDocument()

    searchDeputes.mockResolvedValueOnce([DUPONT])
    type('dupon')

    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument()
    expect(
      screen.queryByText(/Impossible de contacter le service/),
    ).not.toBeInTheDocument()
  })

  it('affiche « aucun député trouvé » sur résultat vide', async () => {
    searchDeputes.mockResolvedValue([])
    render(<App />)

    type('zzz')

    expect(await screen.findByText(/Aucun député trouvé/)).toBeInTheDocument()
  })

  it('prévient que la liste est plafonnée quand l’API renvoie son maximum', async () => {
    const huit = Array.from({ length: 8 }, (_, i) => ({
      ...DUPONT,
      uid: `PA${i}`,
      nom: `Dupont${i}`,
    }))
    searchDeputes.mockResolvedValue(huit)
    render(<App />)

    type('du')

    expect(await screen.findByText(/précisez votre recherche/i)).toBeInTheDocument()
  })

  it('ne prévient pas d’un plafond quand les résultats sont peu nombreux', async () => {
    searchDeputes.mockResolvedValue([DUPONT])
    render(<App />)

    type('dupont')

    await screen.findByText('Jean Dupont')
    expect(screen.queryByText(/précisez votre recherche/i)).not.toBeInTheDocument()
  })

  it('réinitialise les résultats quand le champ est vidé', async () => {
    searchDeputes.mockResolvedValue([DUPONT])
    render(<App />)

    type('dupont')
    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument()

    type('')
    await waitFor(() =>
      expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument(),
    )
  })

  it('ignore la réponse d’une recherche annulée par une frappe plus récente', async () => {
    vi.useFakeTimers()
    // La résolution tardive d'une recherche abandonnée ne doit ni s'afficher,
    // ni éteindre l'indicateur de la recherche en cours.
    let resolvePremiere: (v: Depute[]) => void = () => {}
    searchDeputes.mockImplementationOnce(
      (_q: string, signal: AbortSignal) =>
        new Promise<Depute[]>((resolve, reject) => {
          resolvePremiere = resolve
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          )
        }),
    )
    render(<App />)

    type('dupont')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    searchDeputes.mockReturnValue(new Promise<Depute[]>(() => {}))
    type('dupontX')
    await act(async () => {
      resolvePremiere([DUPONT])
      await Promise.resolve()
    })

    expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument()
    expect(screen.getByText('Recherche…')).toBeInTheDocument()
  })
})
