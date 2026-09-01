import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Tabs,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
  Tooltip,
  message,
} from 'antd'
import {
  FilePdfOutlined,
  CreditCardOutlined,
  WalletOutlined,
  RollbackOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FileAddOutlined,
  UndoOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getFactures,
  genererFactures,
  reglerFacture,
  facturePdf,
  getPaiements,
  rembourserPaiement,
  getWallets,
  crediterWallet,
  getWallet,
  annulerRechargement,
  debiterWallet,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getAbonnements,
  souscrire,
  resilier,
  type PlanInput,
} from '../../api/paiement'
import { getUsers } from '../../api/users'
import { useAuth } from '../../context/AuthContext'
import type {
  Abonnement,
  AbonnementPlan,
  AppUser,
  Facture,
  FactureStatut,
  MoyenPaiement,
  Paiement,
  Wallet,
} from '../../types'

const STATUTS_FACTURE: Record<FactureStatut, { label: string; color: string }> = {
  impayee: { label: 'Impayée', color: 'red' },
  payee: { label: 'Payée', color: 'green' },
  remboursee: { label: 'Remboursée', color: 'purple' },
  annulee: { label: 'Annulée', color: 'default' },
}

const MOYENS: { value: MoyenPaiement; label: string }[] = [
  { value: 'carte', label: 'Carte bancaire' },
  { value: 'wallet', label: 'Porte-monnaie' },
  { value: 'abonnement', label: 'Abonnement' },
  { value: 'differe', label: 'Paiement différé' },
]

const STATUTS_PAIEMENT: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'gold' },
  paye: { label: 'Encaissé', color: 'green' },
  echoue: { label: 'Échoué', color: 'red' },
  rembourse: { label: 'Remboursé', color: 'purple' },
}

/** Les montants du projet sont en dinars, à trois décimales (millimes). */
function dt(montant: number): string {
  return `${montant.toFixed(3)} DT`
}

function moyenLabel(moyen: MoyenPaiement): string {
  return MOYENS.find((m) => m.value === moyen)?.label ?? moyen
}

function messageErreur(error: unknown, defaut: string): string {
  return (
    (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? defaut
  )
}

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(url)
}

function PaiementPage() {
  const { can } = useAuth()
  const canWrite = can('paiement', 'full')

  const [factures, setFactures] = useState<Facture[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [plans, setPlans] = useState<AbonnementPlan[]>([])
  const [abonnements, setAbonnements] = useState<Abonnement[]>([])
  const [clients, setClients] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [filtreStatut, setFiltreStatut] = useState<FactureStatut | undefined>()
  const [recherche, setRecherche] = useState('')
  const [enRetard, setEnRetard] = useState(false)

  const [aRegler, setARegler] = useState<Facture | null>(null)
  const [moyen, setMoyen] = useState<MoyenPaiement>('carte')
  const [aRembourser, setARembourser] = useState<Paiement | null>(null)
  const [motif, setMotif] = useState('')
  const [creditOuvert, setCreditOuvert] = useState(false)
  // Les mouvements ne sont pas dans /wallets : on les charge au dépliage de la
  // ligne, et on les garde pour ne pas refaire l'appel à chaque ouverture.
  const [mouvements, setMouvements] = useState<Record<string, Wallet>>({})
  const [debitOuvert, setDebitOuvert] = useState(false)
  const [planEdite, setPlanEdite] = useState<AbonnementPlan | null>(null)
  const [planModalOuvert, setPlanModalOuvert] = useState(false)
  const [souscriptionOuverte, setSouscriptionOuverte] = useState(false)

  const [formCredit] = Form.useForm<{ userId: string; montant: number; motif?: string }>()
  const [formDebit] = Form.useForm<{ userId: string; montant: number; motif: string }>()
  const [formPlan] = Form.useForm<PlanInput>()
  const [formSouscription] = Form.useForm<{ userId: string; planId: string }>()

  const filtres = useMemo(
    () => ({ statut: filtreStatut, recherche: recherche.trim() || undefined, enRetard }),
    [filtreStatut, recherche, enRetard],
  )

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [f, p, w, pl, ab, us] = await Promise.all([
        getFactures(filtres),
        getPaiements(),
        getWallets(),
        getPlans(),
        getAbonnements(),
        getUsers().catch(() => [] as AppUser[]),
      ])
      setFactures(f)
      setPaiements(p)
      setWallets(w)
      setPlans(pl)
      setAbonnements(ab)
      // Seuls les clients ont un porte-monnaie ou un abonnement ; le rôle
      // Finance n'a pas forcément accès à /users, d'où le repli sur [] ci-dessus.
      setClients(us.filter((u) => u.role === 'Client'))
    } catch {
      message.error('Impossible de charger les données de facturation.')
    } finally {
      setLoading(false)
    }
  }, [filtres])

  useEffect(() => {
    void load()
  }, [load])

  async function handleGenerer() {
    try {
      setSaving(true)
      const bilan = await genererFactures()
      message.success(bilan.message)
      await load()
    } catch {
      message.error('Génération impossible.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePdf(facture: Facture) {
    try {
      telecharger(await facturePdf(facture.id), `${facture.numero}.pdf`)
    } catch {
      message.error('Téléchargement du PDF impossible.')
    }
  }

  async function handleRegler() {
    if (!aRegler) return
    try {
      setSaving(true)
      const reponse = await reglerFacture(aRegler.id, moyen)
      message.success(reponse.message)
      setARegler(null)
      await load()
    } catch (error) {
      message.error(messageErreur(error, 'Règlement impossible.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRembourser() {
    if (!aRembourser || !motif.trim()) return
    try {
      setSaving(true)
      const reponse = await rembourserPaiement(aRembourser.id, motif.trim())
      message.success(reponse.message)
      setARembourser(null)
      setMotif('')
      await load()
    } catch (error) {
      message.error(messageErreur(error, 'Remboursement impossible.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCrediter(values: { userId: string; montant: number; motif?: string }) {
    try {
      setSaving(true)
      const reponse = await crediterWallet(values.userId, values.montant, values.motif)
      message.success(reponse.message)
      setCreditOuvert(false)
      await load()
    } catch (error) {
      message.error(messageErreur(error, 'Rechargement impossible.'))
    } finally {
      setSaving(false)
    }
  }

  async function chargerMouvements(walletId: string) {
    try {
      // L'appel doit être résolu avant le setState : `await` n'a pas sa place
      // dans le callback de mise à jour, qui n'est pas asynchrone.
      const detail = await getWallet(walletId)
      setMouvements((prev) => ({ ...prev, [walletId]: detail }))
    } catch {
      message.error('Impossible de charger les mouvements de ce porte-monnaie.')
    }
  }

  async function handleAnnuler(walletId: string, transactionId: string) {
    try {
      const reponse = await annulerRechargement(transactionId)
      message.success(reponse.message)
      setMouvements((prev) => ({ ...prev, [walletId]: reponse.wallet }))
      await load()
    } catch (error) {
      message.error(messageErreur(error, 'Annulation impossible.'))
    }
  }

  async function handleDebiter(values: { userId: string; montant: number; motif: string }) {
    try {
      setSaving(true)
      const reponse = await debiterWallet(values.userId, values.montant, values.motif)
      message.success(reponse.message)
      setMouvements((prev) => ({ ...prev, [reponse.wallet.id]: reponse.wallet }))
      setDebitOuvert(false)
      await load()
    } catch (error) {
      message.error(messageErreur(error, 'Correction impossible.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePlan(values: PlanInput) {
    try {
      setSaving(true)
      if (planEdite) await updatePlan(planEdite.id, values)
      else await createPlan(values)
      message.success(planEdite ? 'Formule mise à jour.' : 'Formule créée.')
      setPlanModalOuvert(false)
      await load()
    } catch (error) {
      message.error(messageErreur(error, 'Enregistrement impossible.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSouscrire(values: { userId: string; planId: string }) {
    try {
      setSaving(true)
      const reponse = await souscrire(values.userId, values.planId)
      message.success(reponse.message)
      setSouscriptionOuverte(false)
      await load()
    } catch (error) {
      message.error(messageErreur(error, 'Souscription impossible.'))
    } finally {
      setSaving(false)
    }
  }

  const colonnesFactures = [
    {
      title: 'Facture',
      dataIndex: 'numero',
      render: (numero: string, r: Facture) => (
        <div>
          <strong>{numero}</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {r.emiseLe ? dayjs(r.emiseLe).format('DD/MM/YYYY HH:mm') : '—'}
          </div>
        </div>
      ),
    },
    { title: 'Client', dataIndex: 'client' },
    {
      title: 'Prestation',
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
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            HT {dt(r.montantHt)}
            {r.montantRemise > 0 && ` · remise ${r.remisePourcent}%`}
          </div>
        </div>
      ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      render: (statut: FactureStatut, r: Facture) => (
        <div>
          <Tag color={STATUTS_FACTURE[statut].color}>{STATUTS_FACTURE[statut].label}</Tag>
          {r.echeance && (
            <div style={{ fontSize: 12, color: r.enRetard ? '#cf1322' : 'var(--text-muted)' }}>
              {r.enRetard ? 'En retard depuis le ' : 'Échéance '}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => void handlePdf(r)}>
            PDF
          </Button>
          {canWrite && r.statut === 'impayee' && (
            <Button
              size="small"
              type="primary"
              icon={<CreditCardOutlined />}
              onClick={() => {
                setARegler(r)
                setMoyen('carte')
              }}
            >
              Régler
            </Button>
          )}
        </div>
      ),
    },
  ]

  const colonnesPaiements = [
    {
      title: 'Date',
      dataIndex: 'payeLe',
      width: 150,
      render: (date: string | null) => (
        <span style={{ fontSize: 13 }}>
          {date ? dayjs(date).format('DD/MM/YYYY HH:mm') : '—'}
        </span>
      ),
    },
    { title: 'Facture', dataIndex: 'numeroFacture', render: (v?: string | null) => v ?? '—' },
    { title: 'Client', dataIndex: 'client', render: (v?: string | null) => v ?? '—' },
    {
      title: 'Moyen',
      dataIndex: 'moyen',
      render: (moyen: MoyenPaiement, r: Paiement) => (
        <div>
          {moyenLabel(moyen)}
          {r.reference && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <code>{r.reference}</code>
            </div>
          )}
        </div>
      ),
    },
    { title: 'Montant', dataIndex: 'montant', render: (m: number) => dt(m) },
    {
      title: 'Statut',
      dataIndex: 'statut',
      render: (statut: string, r: Paiement) => (
        <div>
          <Tag color={STATUTS_PAIEMENT[statut]?.color}>
            {STATUTS_PAIEMENT[statut]?.label ?? statut}
          </Tag>
          {r.motifRemboursement && (
            <Tooltip title={r.motifRemboursement}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>
                {r.motifRemboursement}
              </div>
            </Tooltip>
          )}
        </div>
      ),
    },
    ...(canWrite
      ? [
          {
            title: '',
            dataIndex: 'actions',
            render: (_: unknown, r: Paiement) =>
              r.remboursable ? (
                <Button
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    setARembourser(r)
                    setMotif('')
                  }}
                >
                  Rembourser
                </Button>
              ) : null,
          },
        ]
      : []),
  ]

  const colonnesWallets = [
    { title: 'Client', dataIndex: 'client', render: (v: string | null) => v ?? '—' },
    {
      title: 'Solde',
      dataIndex: 'solde',
      render: (solde: number) => (
        <strong style={{ color: solde > 0 ? '#237804' : 'var(--text-muted)' }}>{dt(solde)}</strong>
      ),
    },
  ]

  const colonnesPlans = [
    {
      title: 'Formule',
      dataIndex: 'nom',
      render: (nom: string, r: AbonnementPlan) => (
        <div>
          <strong>{nom}</strong>
          {!r.actif && <Tag style={{ marginLeft: 6 }}>retirée du catalogue</Tag>}
          {r.description && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.description}</div>
          )}
        </div>
      ),
    },
    { title: 'Prix mensuel', dataIndex: 'prixMensuel', render: (p: number) => dt(p) },
    {
      title: 'Remise',
      dataIndex: 'remisePourcent',
      render: (r: number) => <Tag color="blue">{r} %</Tag>,
    },
    { title: 'Abonnés', dataIndex: 'abonnes', render: (n: number | null) => n ?? 0 },
    ...(canWrite
      ? [
          {
            title: '',
            dataIndex: 'actions',
            render: (_: unknown, r: AbonnementPlan) => (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setPlanEdite(r)
                    formPlan.setFieldsValue({
                      nom: r.nom,
                      description: r.description ?? undefined,
                      prixMensuel: r.prixMensuel,
                      remisePourcent: r.remisePourcent,
                      actif: r.actif,
                    })
                    setPlanModalOuvert(true)
                  }}
                >
                  Modifier
                </Button>
                <Popconfirm
                  title="Supprimer cette formule ?"
                  description="Si des clients y sont abonnés, elle sera simplement retirée du catalogue."
                  onConfirm={async () => {
                    try {
                      const r2 = await deletePlan(r.id)
                      message.success(r2.message)
                      await load()
                    } catch (error) {
                      message.error(messageErreur(error, 'Suppression impossible.'))
                    }
                  }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Supprimer
                  </Button>
                </Popconfirm>
              </div>
            ),
          },
        ]
      : []),
  ]

  const colonnesAbonnements = [
    { title: 'Client', dataIndex: 'client', render: (v: string | null) => v ?? '—' },
    { title: 'Formule', dataIndex: 'plan' },
    { title: 'Prix mensuel', dataIndex: 'prixMensuel', render: (p: number) => dt(p) },
    {
      title: 'Remise',
      dataIndex: 'remisePourcent',
      render: (r: number) => <Tag color="blue">{r} %</Tag>,
    },
    {
      title: 'Période',
      dataIndex: 'debut',
      render: (debut: string | null, r: Abonnement) => (
        <span style={{ fontSize: 13 }}>
          {debut ? dayjs(debut).format('DD/MM/YYYY') : '—'}
          {r.fin ? ` → ${dayjs(r.fin).format('DD/MM/YYYY')}` : ''}
        </span>
      ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      render: (statut: string, r: Abonnement) => (
        <Tag color={r.enCours ? 'green' : 'default'}>
          {{ actif: 'Actif', resilie: 'Résilié', expire: 'Expiré' }[statut] ?? statut}
        </Tag>
      ),
    },
    ...(canWrite
      ? [
          {
            title: '',
            dataIndex: 'actions',
            render: (_: unknown, r: Abonnement) =>
              r.enCours ? (
                <Popconfirm
                  title="Résilier cet abonnement ?"
                  description="La remise cessera de s'appliquer aux prochaines factures."
                  onConfirm={async () => {
                    try {
                      const rep = await resilier(r.id)
                      message.success(rep.message)
                      await load()
                    } catch (error) {
                      message.error(messageErreur(error, 'Résiliation impossible.'))
                    }
                  }}
                >
                  <Button size="small" danger>
                    Résilier
                  </Button>
                </Popconfirm>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="page-toolbar">
        <p style={{ margin: 0 }}>
          Facturation, règlements, porte-monnaie et abonnements. Une facture est émise
          automatiquement à la fin de chaque session rattachée à un client.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            Actualiser
          </Button>
          {canWrite && (
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={() => void handleGenerer()}
              loading={saving}
            >
              Générer les factures manquantes
            </Button>
          )}
        </div>
      </div>

      <Tabs
        items={[
          {
            key: 'factures',
            label: `Factures (${factures.length})`,
            children: (
              <>
                <div className="panel" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                      allowClear
                      placeholder="Tous les statuts"
                      style={{ width: 180 }}
                      value={filtreStatut}
                      onChange={setFiltreStatut}
                      options={Object.entries(STATUTS_FACTURE).map(([value, m]) => ({
                        label: m.label,
                        value,
                      }))}
                    />
                    <Input.Search
                      allowClear
                      placeholder="Numéro ou client…"
                      style={{ width: 260 }}
                      onSearch={setRecherche}
                    />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Switch checked={enRetard} onChange={setEnRetard} size="small" />
                      Impayées en retard seulement
                    </span>
                  </div>
                </div>
                <div className="panel">
                  <Table
                    rowKey="id"
                    columns={colonnesFactures}
                    dataSource={factures}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'Aucune facture.' }}
                  />
                </div>
              </>
            ),
          },
          {
            key: 'paiements',
            label: `Règlements (${paiements.length})`,
            children: (
              <div className="panel">
                <Table
                  rowKey="id"
                  columns={colonnesPaiements}
                  dataSource={paiements}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: 'Aucun règlement.' }}
                />
              </div>
            ),
          },
          {
            key: 'wallets',
            label: `Porte-monnaie (${wallets.length})`,
            children: (
              <>
                {canWrite && (
                  <div className="page-toolbar">
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                      Le porte-monnaie est créé au premier rechargement.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        icon={<MinusCircleOutlined />}
                        onClick={() => {
                          formDebit.resetFields()
                          setDebitOuvert(true)
                        }}
                      >
                        Corriger un solde
                      </Button>
                      <Button
                        type="primary"
                        icon={<WalletOutlined />}
                        onClick={() => {
                          formCredit.resetFields()
                          setCreditOuvert(true)
                        }}
                      >
                        Recharger un porte-monnaie
                      </Button>
                    </div>
                  </div>
                )}
                <div className="panel">
                  <Table
                    rowKey="id"
                    columns={colonnesWallets}
                    dataSource={wallets}
                    loading={loading}
                    pagination={false}
                    locale={{ emptyText: 'Aucun porte-monnaie ouvert.' }}
                    expandable={{
                      // Les mouvements ne sont pas dans /wallets : on les
                      // demande au dépliage, une seule fois par porte-monnaie.
                      onExpand: (ouvert, w) => {
                        if (ouvert && !mouvements[w.id]) void chargerMouvements(w.id)
                      },
                      rowExpandable: () => true,
                      expandedRowRender: (w) => {
                        const detail = mouvements[w.id]
                        if (!detail) {
                          return <span style={{ color: 'var(--text-muted)' }}>Chargement…</span>
                        }
                        const lignes = detail.transactions ?? []
                        if (lignes.length === 0) {
                          return <span style={{ color: 'var(--text-muted)' }}>Aucun mouvement.</span>
                        }
                        return (
                          <table className="mini-table" style={{ maxWidth: 860 }}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Motif</th>
                                <th>Mouvement</th>
                                <th>Solde après</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {lignes.map((t) => (
                                <tr key={t.id} style={{ opacity: t.annule ? 0.55 : 1 }}>
                                  <td>{dayjs(t.date).format('DD/MM/YYYY HH:mm')}</td>
                                  <td>
                                    {t.motif}
                                    {t.annule && (
                                      <Tag color="default" style={{ marginLeft: 6 }}>
                                        annulé
                                      </Tag>
                                    )}
                                  </td>
                                  <td style={{ color: t.type === 'credit' ? '#237804' : '#cf1322' }}>
                                    {t.type === 'credit' ? '+' : '−'} {dt(t.montant)}
                                  </td>
                                  <td>{dt(t.soldeApres)}</td>
                                  <td>
                                    {canWrite && t.annulable && (
                                      <Popconfirm
                                        title="Annuler ce rechargement ?"
                                        description="Un débit de correction sera ajouté ; les deux mouvements resteront visibles."
                                        onConfirm={() => void handleAnnuler(w.id, t.id)}
                                      >
                                        <Button size="small" icon={<UndoOutlined />}>
                                          Annuler
                                        </Button>
                                      </Popconfirm>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      },
                    }}
                  />
                </div>
              </>
            ),
          },
          {
            key: 'abonnements',
            label: `Abonnements (${abonnements.length})`,
            children: (
              <>
                <div className="page-toolbar">
                  <h3 style={{ margin: 0 }}>Formules</h3>
                  {canWrite && (
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setPlanEdite(null)
                        formPlan.resetFields()
                        formPlan.setFieldsValue({ actif: true, remisePourcent: 0 })
                        setPlanModalOuvert(true)
                      }}
                    >
                      Nouvelle formule
                    </Button>
                  )}
                </div>
                <div className="panel" style={{ marginBottom: 24 }}>
                  <Table
                    rowKey="id"
                    columns={colonnesPlans}
                    dataSource={plans}
                    loading={loading}
                    pagination={false}
                    locale={{ emptyText: 'Aucune formule au catalogue.' }}
                  />
                </div>

                <div className="page-toolbar">
                  <h3 style={{ margin: 0 }}>Souscriptions</h3>
                  {canWrite && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        formSouscription.resetFields()
                        setSouscriptionOuverte(true)
                      }}
                    >
                      Abonner un client
                    </Button>
                  )}
                </div>
                <div className="panel">
                  <Table
                    rowKey="id"
                    columns={colonnesAbonnements}
                    dataSource={abonnements}
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    locale={{ emptyText: 'Aucune souscription.' }}
                  />
                </div>
              </>
            ),
          },
        ]}
      />

      <Modal
        title={aRegler ? `Régler la facture ${aRegler.numero}` : ''}
        open={Boolean(aRegler)}
        onCancel={() => setARegler(null)}
        onOk={() => void handleRegler()}
        confirmLoading={saving}
        okText="Enregistrer le règlement"
        cancelText="Annuler"
      >
        <p style={{ marginTop: 0 }}>
          Montant dû : <strong>{aRegler ? dt(aRegler.montantTtc) : ''}</strong>
        </p>
        <Select
          style={{ width: '100%' }}
          value={moyen}
          onChange={setMoyen}
          options={MOYENS.map((m) => ({ label: m.label, value: m.value }))}
        />
        {moyen === 'wallet' && (
          <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>
            Le montant sera débité du porte-monnaie du client ; le règlement est refusé si le
            solde est insuffisant.
          </p>
        )}
        {moyen === 'differe' && (
          <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>
            La facture reste impayée avec une échéance à 30 jours.
          </p>
        )}
      </Modal>

      <Modal
        title="Rembourser ce règlement"
        open={Boolean(aRembourser)}
        onCancel={() => setARembourser(null)}
        onOk={() => void handleRembourser()}
        confirmLoading={saving}
        okButtonProps={{ disabled: !motif.trim() }}
        okText="Rembourser"
        cancelText="Annuler"
      >
        <p style={{ marginTop: 0 }}>
          Montant : <strong>{aRembourser ? dt(aRembourser.montant) : ''}</strong>
          {aRembourser?.moyen === 'wallet' && ' — il sera recrédité sur le porte-monnaie du client.'}
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Motif du remboursement (obligatoire)"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </Modal>

      <Modal
        title="Recharger un porte-monnaie"
        open={creditOuvert}
        onCancel={() => setCreditOuvert(false)}
        onOk={() => formCredit.submit()}
        confirmLoading={saving}
        okText="Créditer"
        cancelText="Annuler"
        destroyOnHidden
      >
        <Form form={formCredit} layout="vertical" onFinish={(v) => void handleCrediter(v)}>
          <Form.Item label="Client" name="userId" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Choisir un client"
              options={clients.map((c) => ({ label: c.nom, value: c.id }))}
            />
          </Form.Item>
          <Form.Item label="Montant (DT)" name="montant" rules={[{ required: true }]}>
            <InputNumber min={0.001} max={100000} step={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Motif" name="motif">
            <Input placeholder="Rechargement en agence…" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Corriger un solde"
        open={debitOuvert}
        onCancel={() => setDebitOuvert(false)}
        onOk={() => formDebit.submit()}
        confirmLoading={saving}
        okText="Débiter"
        cancelText="Annuler"
        destroyOnHidden
      >
        <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
          Retrait manuel, à utiliser quand un rechargement erroné a déjà été partiellement
          dépensé et ne peut plus être annulé en bloc. Pour annuler un rechargement intact,
          dépliez la ligne du client et utilisez « Annuler ».
        </p>
        <Form form={formDebit} layout="vertical" onFinish={(v) => void handleDebiter(v)}>
          <Form.Item label="Client" name="userId" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Choisir un client"
              options={clients.map((c) => ({ label: c.nom, value: c.id }))}
            />
          </Form.Item>
          <Form.Item label="Montant à retirer (DT)" name="montant" rules={[{ required: true }]}>
            <InputNumber min={0.001} max={100000} step={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Motif"
            name="motif"
            rules={[{ required: true, message: 'Un motif est obligatoire pour tracer la correction' }]}
          >
            <Input placeholder="Correction d'un rechargement erroné…" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={planEdite ? 'Modifier la formule' : 'Nouvelle formule'}
        open={planModalOuvert}
        onCancel={() => setPlanModalOuvert(false)}
        onOk={() => formPlan.submit()}
        confirmLoading={saving}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnHidden
      >
        <Form form={formPlan} layout="vertical" onFinish={(v) => void handleSavePlan(v)}>
          <Form.Item label="Nom" name="nom" rules={[{ required: true }]}>
            <Input placeholder="Premium, Flotte…" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Prix mensuel (DT)" name="prixMensuel" rules={[{ required: true }]}>
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Remise sur les recharges (%)"
            name="remisePourcent"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Proposée au catalogue" name="actif" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Abonner un client"
        open={souscriptionOuverte}
        onCancel={() => setSouscriptionOuverte(false)}
        onOk={() => formSouscription.submit()}
        confirmLoading={saving}
        okText="Souscrire"
        cancelText="Annuler"
        destroyOnHidden
      >
        <Form form={formSouscription} layout="vertical" onFinish={(v) => void handleSouscrire(v)}>
          <Form.Item label="Client" name="userId" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Choisir un client"
              options={clients.map((c) => ({ label: c.nom, value: c.id }))}
            />
          </Form.Item>
          <Form.Item label="Formule" name="planId" rules={[{ required: true }]}>
            <Select
              placeholder="Choisir une formule"
              options={plans
                .filter((p) => p.actif)
                .map((p) => ({ label: `${p.nom} — ${p.remisePourcent} %`, value: p.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PaiementPage
