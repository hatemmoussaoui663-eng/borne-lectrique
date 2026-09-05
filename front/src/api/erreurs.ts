/**
 * Message d'erreur renvoyé par l'API, ou un texte de repli si la réponse
 * n'en contient pas (panne réseau, 500 sans corps...).
 */
export function messageErreurApi(error: unknown, repli: string): string {
  const donnees =
    error && typeof error === 'object' && 'response' in error
      ? (error.response as { data?: unknown } | undefined)?.data
      : undefined

  if (donnees && typeof donnees === 'object' && 'message' in donnees) {
    return String((donnees as { message: unknown }).message)
  }

  return repli
}
