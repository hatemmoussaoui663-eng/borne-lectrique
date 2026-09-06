import { useEffect, useState } from 'react'
import { Table, Tag, Button, message, Spin } from 'antd'
import { FilePdfOutlined, WalletOutlined, StarOutlined, FileTextOutlined, CreditCardOutlined } from '@ant-design/icons'
import ModaleRechargement from '../../components/client/ModaleRechargement'
import dayjs from 'dayjs'
import StatCard from '../../components/admin/StatCard'
import {
  getMesFactures,
  getMonWallet,
  getMesAbonnements,
  facturePdf,
} from '../../api/paiement'
import type { Abonnement, Facture, FactureStatut, Wallet } from '../../types'

const STATUTS: Record<FactureStatut, { label: string; color: string }> = {
  impayee: { label: 'À régler', color: 'red' },
  payee: { label: 'Payée', color: 'green' },
  remboursee: { label: 'Remboursée', color: 'purple' },
  annulee: { label: 'Annulée', color: 'default' },
}

function dt(montant: number): string {
  return `${montant.toFixed(3)} DT`
}

/**
 * Espace client, volet Paiement. Le §7 du cahier des charges donne au rôle
 * Client un accès « Lecture » sur le module : il ne gère ni les factures des
 * autres, ni les remboursements. Il peut en revanche recharger son propre
 * porte-monnaie par carte, ce qui solde automatiquement ses impayés — payer ce
 * qu'on doit n'est pas administrer le module.
 */
function ClientFactures() {
  const [factures, setFactures] = useState<Facture[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null)
  const [loading, setLoading] = useState(true)
  const [rechargementOuvert, setRechargementOuvert] = useState(false)

  useEffect(() => {
    Promise.all([getMesFactures(), getMonWallet(), getMesAbonnements()])
      .then(([f, w, a]) => {
        setFactures(f)
        setWallet(w)
        setAbonnement(a.find((x) => x.enCours) ?? null)
      })
      .catch(() => message.error('Impossible de charger vos factures.'))
      .finally(() => setLoading(false))
  }, [])

  async function handlePdf(facture: Facture) {
    try {
      const blob = await facturePdf(facture.id, true)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = `${facture.numero}.pdf`
      lien.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Téléchargement impossible.')
    }
  }

  const impayees = factures.filter((f) => f.statut === 'impayee')
  const totalDu = impayees.reduce((somme, f) => somme + f.montantTtc, 0)

  const columns = [
    {
      title: 'Facture',
      dataIndex: 'numero',
      render: (numero: string, r: Facture) => (
        <div>
          <strong>{numero}</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {r.emiseLe ? dayjs(r.emiseLe).format('DD/MM/YYYY') : '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Recharge',
      dataIndex: 'borne',
      render: (borne: string | null, r: Facture) => (
        <div style={{ fontSize: 13 }}>
          {borne ?? '—'}
          {r.energieKwh !== null && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {r.energieKwh.toFixed(3)} kWh
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Montant',
      dataIndex: 'montantTtc',
      render: (ttc: number, r: Facture) => (
        <div>
          <strong>{dt(ttc)}</strong>
          {r.montantRemise > 0 && (
            <div style={{ fontSize: 12, color: '#237804' }}>
              remise abonné −{dt(r.montantRemise)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      render: (statut: FactureStatut, r: Facture) => (
        <div>
          <Tag color={STATUTS[statut].color}>{STATUTS[statut].label}</Tag>
          {r.echeance && (
            <div style={{ fontSize: 12, color: r.enRetard ? '#cf1322' : 'var(--text-muted)' }}>
              {r.enRetard ? 'En retard depuis le ' : 'À régler avant le '}
              {dayjs(r.echeance).format('DD/MM/YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '',
      dataIndex: 'actions',
      render: (_: unknown, r: Facture) => (
        <Button size="small" icon={<FilePdfOutlined />} onClick={() => void handlePdf(r)}>
          Télécharger
        </Button>
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </div>
    )
  }

  return (
    <div>
      {/* Grille en ligne plutôt qu'une classe : `admin-dashboard__stats` vit
          dans le CSS d'une page d'administration, que l'espace client n'a pas
          à importer pour trois tuiles. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          icon={<WalletOutlined />}
          label="Solde de mon porte-monnaie"
          value={dt(wallet?.solde ?? 0)}
        />
        <StatCard
          icon={<FileTextOutlined />}
          label="Reste à régler"
          value={dt(totalDu)}
          hint={`${impayees.length} facture${impayees.length > 1 ? 's' : ''} en attente`}
        />
        <StatCard
          icon={<StarOutlined />}
          label="Mon abonnement"
          value={abonnement?.plan ?? 'Aucun'}
          hint={
            abonnement
              ? `${abonnement.remisePourcent} % de remise sur mes recharges`
              : 'Aucune remise en cours'
          }
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button
          type="primary"
          size="large"
          icon={<CreditCardOutlined />}
          onClick={() => setRechargementOuvert(true)}
        >
          Recharger par carte
        </Button>
      </div>

      <div className="panel">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={factures}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Aucune facture pour le moment.' }}
        />
      </div>
      <ModaleRechargement
        open={rechargementOuvert}
        onClose={() => setRechargementOuvert(false)}
        titulaireParDefaut={wallet?.client ?? undefined}
        onSucces={(resultat) => {
          // Le serveur renvoie le solde après crédit et règlement : on l'applique
          // directement, puis on relit les factures dont les statuts ont changé.
          setWallet((precedent) =>
            precedent ? { ...precedent, solde: resultat.solde } : precedent,
          )
          void getMesFactures().then(setFactures).catch(() => undefined)
        }}
      />
    </div>
  )
}

export default ClientFactures
