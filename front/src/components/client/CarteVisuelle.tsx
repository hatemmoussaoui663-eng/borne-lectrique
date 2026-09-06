import carteFond from '../../assets/carte.png'
import './CarteVisuelle.css'

interface CarteVisuelleProps {
  /** Numéro en cours de saisie, chiffres et espaces mêlés. */
  numero: string
  titulaire: string
  moisExpiration?: number
  anneeExpiration?: number
  /** Banque déduite du BIN, affichée dès qu'elle est reconnue. */
  banque?: string | null
}

/** Numéro affiché par groupes de 4, les positions non saisies en pointillé. */
function numeroAffiche(numero: string): string {
  const chiffres = numero.replace(/\D/g, '').slice(0, 16)
  const complet = chiffres.padEnd(16, '•')

  return (complet.match(/.{1,4}/g) ?? []).join(' ')
}

/**
 * Aperçu de la carte pendant la saisie. Purement visuel : rien n'en sort et
 * rien n'y entre en dehors des props.
 */
function CarteVisuelle({
  numero,
  titulaire,
  moisExpiration,
  anneeExpiration,
  banque,
}: CarteVisuelleProps) {
  const expiration =
    moisExpiration && anneeExpiration
      ? `${String(moisExpiration).padStart(2, '0')}/${String(anneeExpiration).slice(-2)}`
      : 'MM/AA'

  return (
    <div className="carte-visuelle">
      <img className="carte-visuelle__fond" src={carteFond} alt="" aria-hidden="true" />

      {banque && <div className="carte-visuelle__banque">{banque}</div>}

      <div className="carte-visuelle__champ carte-visuelle__numero">
        {numeroAffiche(numero)}
      </div>

      <div className="carte-visuelle__champ carte-visuelle__titulaire">
        <span className="carte-visuelle__intitule">Titulaire</span>
        <span className="carte-visuelle__valeur">{titulaire || 'NOM PRÉNOM'}</span>
      </div>

      <div className="carte-visuelle__champ carte-visuelle__expiration">
        <span className="carte-visuelle__intitule">Expire fin</span>
        <span className="carte-visuelle__valeur">{expiration}</span>
      </div>
    </div>
  )
}

export default CarteVisuelle
