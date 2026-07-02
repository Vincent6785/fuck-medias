import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Depute } from './api'

// Le composant est testé isolément : la couche API est mockée.
const { searchDeputes, deputeUrl } = vi.hoisted(() => ({
  searchDeputes: vi.fn(),
  deputeUrl: vi.fn((slug: string) => `https://civix.test/${slug}`),
}))

vi.mock('./api', () => ({ searchDeputes, deputeUrl }))

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
})

afterEach(() => {
  cleanup()
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
    // Avant l'échéance du debounce : aucun appel.
    expect(searchDeputes).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(searchDeputes).toHaveBeenCalledTimes(1)
    expect(searchDeputes).toHaveBeenCalledWith('Dup', expect.any(AbortSignal))
  })

  it('affiche les résultats avec la ligne meta jointe', async () => {
    searchDeputes.mockResolvedValue([DUPONT])
    render(<App />)

    type('dupont')

    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument()
    expect(screen.getByText('REN · Paris')).toBeInTheDocument()
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

  it('affiche un message d’erreur quand l’API échoue', async () => {
    searchDeputes.mockRejectedValue(new Error('boom'))
    render(<App />)

    type('dupont')

    expect(
      await screen.findByText(/Impossible de contacter le service/),
    ).toBeInTheDocument()
  })

  it('affiche « aucun député trouvé » sur résultat vide', async () => {
    searchDeputes.mockResolvedValue([])
    render(<App />)

    type('zzz')

    expect(await screen.findByText(/Aucun député trouvé/)).toBeInTheDocument()
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
})
