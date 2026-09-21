// Accès à l'API publique civix.fr (CORS ouvert : appel direct depuis le navigateur).

const API_BASE = 'https://www.civix.fr/api/v1'

const MAX_QUERY_LENGTH = 100

/**
 * Vérifié sur l'API réelle : `/search` plafonne `results.deputes` à 8 et ignore
 * `page_size`. Le champ `total` de la réponse n'aide pas à annoncer « 8 sur N »,
 * il agrège toutes les catégories (députés, scrutins, dossiers, groupes).
 */
export const API_RESULT_CAP = 8

/** Erreur HTTP de l'API, porteuse du statut pour distinguer 429 d'une panne. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Erreur API (${status})`)
    this.name = 'ApiError'
    this.status = status
  }
}

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

export function deputeUrl(slug: string): string {
  // Le slug vient de l'API : l'encoder empêche un slug malformé d'altérer le
  // chemin ou d'injecter des paramètres.
  return `https://www.civix.fr/deputes/${encodeURIComponent(slug)}?tab=votes-vedettes`
}

/**
 * `RawDepute` n'existe qu'à la compilation : sans ce filtre, une entrée
 * malformée donnerait un `uid` `undefined`, donc des clés React dupliquées.
 */
function isRawDepute(value: unknown): value is RawDepute {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  return (
    typeof d.acteur_uid === 'string' &&
    typeof d.slug === 'string' &&
    typeof d.prenom === 'string' &&
    typeof d.nom === 'string'
  )
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Lève une `ApiError` sur statut HTTP non-OK ; laisse remonter les erreurs
 * réseau et les corps JSON invalides.
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
    throw new ApiError(res.status)
  }

  const data: unknown = await res.json()
  const deputes = (data as { results?: { deputes?: unknown } } | null)?.results
    ?.deputes
  const raw: unknown[] = Array.isArray(deputes) ? deputes : []

  return raw.filter(isRawDepute).map((d) => ({
    uid: d.acteur_uid,
    prenom: d.prenom,
    nom: d.nom,
    groupe: optionalString(d.groupe_libelle_abrev),
    departement: optionalString(d.circ_departement),
    slug: d.slug,
  }))
}
