// Accès à l'API publique civix.fr (CORS ouvert : appel direct depuis le navigateur).

const API_BASE = 'https://www.civix.fr/api/v1'

export interface Depute {
  uid: string
  prenom: string
  nom: string
  groupe: string
  departement: string
  slug: string
}

interface RawDepute {
  acteur_uid: string
  prenom: string
  nom: string
  groupe_libelle_abrev?: string
  circ_departement?: string
  slug: string
}

/** URL publique de la page civix.fr du député (onglet votes vedettes). */
export function deputeUrl(slug: string): string {
  return `https://www.civix.fr/deputes/${slug}?tab=votes-vedettes`
}

/**
 * Recherche des députés par nom via l'endpoint /search.
 * Renvoie une liste normalisée. Lève une erreur en cas de problème réseau/HTTP.
 */
export async function searchDeputes(
  query: string,
  signal?: AbortSignal,
): Promise<Depute[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const url = `${API_BASE}/search?search=${encodeURIComponent(trimmed)}&page_size=10`
  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`Erreur API (${res.status})`)
  }

  const data = await res.json()
  const raw: RawDepute[] = data?.results?.deputes ?? []

  return raw.map((d) => ({
    uid: d.acteur_uid,
    prenom: d.prenom,
    nom: d.nom,
    groupe: d.groupe_libelle_abrev ?? '',
    departement: d.circ_departement ?? '',
    slug: d.slug,
  }))
}
