// Accès à l'API publique civix.fr (CORS ouvert : appel direct depuis le navigateur).

const API_BASE = 'https://www.civix.fr/api/v1'

/** Longueur maximale d'une requête (évite d'envoyer une entrée démesurée à l'API). */
const MAX_QUERY_LENGTH = 100

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
  // Le slug vient de l'API : on l'encode pour qu'un slug malformé ne puisse pas
  // altérer le chemin ou injecter des paramètres dans l'URL.
  return `https://www.civix.fr/deputes/${encodeURIComponent(slug)}?tab=votes-vedettes`
}

/**
 * Recherche des députés par nom via l'endpoint /search.
 * Renvoie une liste normalisée. Lève une erreur en cas de problème réseau/HTTP.
 */
export async function searchDeputes(
  query: string,
  signal?: AbortSignal,
): Promise<Depute[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH)
  if (!trimmed) return []

  const url = `${API_BASE}/search?search=${encodeURIComponent(trimmed)}&page_size=10`
  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`Erreur API (${res.status})`)
  }

  const data = await res.json()
  // Garde de type : une réponse malformée (deputes non-tableau) ne doit pas
  // provoquer un TypeError sur .map().
  const raw: RawDepute[] = Array.isArray(data?.results?.deputes)
    ? data.results.deputes
    : []

  return raw.map((d) => ({
    uid: d.acteur_uid,
    prenom: d.prenom,
    nom: d.nom,
    groupe: d.groupe_libelle_abrev ?? '',
    departement: d.circ_departement ?? '',
    slug: d.slug,
  }))
}
