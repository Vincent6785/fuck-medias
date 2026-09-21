import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, deputeUrl, searchDeputes } from './api'

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('deputeUrl', () => {
  it('construit l’URL des votes vedettes', () => {
    expect(deputeUrl('jean-dupont')).toBe(
      'https://www.civix.fr/deputes/jean-dupont?tab=votes-vedettes',
    )
  })

  it('encode le slug pour neutraliser les caractères spéciaux', () => {
    // Un slug malformé ne doit pas pouvoir altérer le chemin/les paramètres.
    expect(deputeUrl('a/b?x=1')).toBe(
      'https://www.civix.fr/deputes/a%2Fb%3Fx%3D1?tab=votes-vedettes',
    )
  })
})

describe('searchDeputes', () => {
  it('renvoie [] sans appel réseau pour une requête vide ou blanche', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchDeputes('')).toEqual([])
    expect(await searchDeputes('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('trimme et encode la requête dans l’URL appelée', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ results: { deputes: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await searchDeputes('  Dupont & Cie  ')

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toBe(
      'https://www.civix.fr/api/v1/search?search=Dupont%20%26%20Cie&page_size=10',
    )
  })

  it('transmet le signal d’annulation à fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ results: { deputes: [] } }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await searchDeputes('x', controller.signal)

    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      signal: controller.signal,
    })
  })

  it('lève une ApiError portant le statut sur réponse non-OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(null, false, 500)),
    )

    await expect(searchDeputes('x')).rejects.toThrow('Erreur API (500)')
  })

  it('expose le statut 429 pour permettre un message « quota dépassé »', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(null, false, 429)),
    )

    await expect(searchDeputes('x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
    })
    await expect(searchDeputes('x')).rejects.toBeInstanceOf(ApiError)
  })

  it('laisse remonter une panne réseau (fetch qui rejette)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    await expect(searchDeputes('x')).rejects.toThrow('Failed to fetch')
  })

  it('laisse remonter un corps JSON invalide', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        },
      } as unknown as Response),
    )

    await expect(searchDeputes('x')).rejects.toThrow(SyntaxError)
  })

  it('normalise les députés renvoyés par l’API', async () => {
    const raw = {
      results: {
        deputes: [
          {
            acteur_uid: 'PA123',
            prenom: 'Jean',
            nom: 'Dupont',
            groupe_libelle_abrev: 'REN',
            circ_departement: 'Paris',
            slug: 'jean-dupont',
          },
        ],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(raw)))

    expect(await searchDeputes('dupont')).toEqual([
      {
        uid: 'PA123',
        prenom: 'Jean',
        nom: 'Dupont',
        groupe: 'REN',
        departement: 'Paris',
        slug: 'jean-dupont',
      },
    ])
  })

  it('remplace les champs optionnels absents par une chaîne vide', async () => {
    const raw = {
      results: {
        deputes: [
          { acteur_uid: 'PA1', prenom: 'A', nom: 'B', slug: 'a-b' },
        ],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(raw)))

    const [d] = await searchDeputes('a')
    expect(d!.groupe).toBe('')
    expect(d!.departement).toBe('')
  })

  it('renvoie [] quand results/deputes est absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({})))
    expect(await searchDeputes('x')).toEqual([])

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ results: null })),
    )
    expect(await searchDeputes('x')).toEqual([])
  })

  it('renvoie [] sans planter quand deputes n’est pas un tableau', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ results: { deputes: 'oops' } })),
    )
    expect(await searchDeputes('x')).toEqual([])

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ results: { deputes: { a: 1 } } })),
    )
    expect(await searchDeputes('x')).toEqual([])
  })

  it('normalise plusieurs députés en une passe', async () => {
    const raw = {
      results: {
        deputes: [
          {
            acteur_uid: 'PA1',
            prenom: 'Jean',
            nom: 'Dupont',
            groupe_libelle_abrev: 'REN',
            circ_departement: 'Paris',
            slug: 'jean-dupont',
          },
          { acteur_uid: 'PA2', prenom: 'Marie', nom: 'Martin', slug: 'marie-martin' },
        ],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(raw)))

    const deputes = await searchDeputes('x')
    expect(deputes).toHaveLength(2)
    expect(deputes[1]).toEqual({
      uid: 'PA2',
      prenom: 'Marie',
      nom: 'Martin',
      groupe: '',
      departement: '',
      slug: 'marie-martin',
    })
  })

  it('écarte les entrées auxquelles il manque un champ indispensable', async () => {
    const raw = {
      results: {
        deputes: [
          { acteur_uid: 'PA1', prenom: 'Jean', nom: 'Dupont', slug: 'jean-dupont' },
          { prenom: 'Sans', nom: 'Uid', slug: 'sans-uid' },
          { acteur_uid: 'PA3', prenom: 'Sans', nom: 'Slug' },
          { acteur_uid: 42, prenom: 'Mauvais', nom: 'Type', slug: 'x' },
          null,
          'pas un objet',
        ],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(raw)))

    const deputes = await searchDeputes('x')
    expect(deputes).toHaveLength(1)
    expect(deputes[0]!.uid).toBe('PA1')
  })

  it('ignore un champ optionnel au mauvais type plutôt que de l’afficher', async () => {
    const raw = {
      results: {
        deputes: [
          {
            acteur_uid: 'PA1',
            prenom: 'Jean',
            nom: 'Dupont',
            slug: 'jean-dupont',
            groupe_libelle_abrev: 123,
            circ_departement: { nom: 'Paris' },
          },
        ],
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(raw)))

    const [d] = await searchDeputes('x')
    expect(d!.groupe).toBe('')
    expect(d!.departement).toBe('')
  })

  it('laisse passer une requête de exactement 100 caractères', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ results: { deputes: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await searchDeputes('b'.repeat(100))

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(new URL(calledUrl).searchParams.get('search')).toBe('b'.repeat(100))
  })

  it('borne la requête à 100 caractères avant l’appel', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ results: { deputes: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await searchDeputes('a'.repeat(500))

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    const search = new URL(calledUrl).searchParams.get('search')
    expect(search).toBe('a'.repeat(100))
  })
})
