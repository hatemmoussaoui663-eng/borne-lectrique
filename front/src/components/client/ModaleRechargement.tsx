import { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, Alert, Button, message } from 'antd'
import { CreditCardOutlined, LockOutlined } from '@ant-design/icons'
import CarteVisuelle from './CarteVisuelle'
import { rechargerParCarte, getBanquesAcceptees } from '../../api/paiement'
import type { BanqueAcceptee } from '../../api/paiement'
import type { ResultatRechargement } from '../../types'

interface ModaleRechargementProps {
  open: boolean
  onClose: () => void
  /** Remonte le nouveau solde pour rafraîchir la page sans second appel. */
  onSucces: (resultat: ResultatRechargement) => void
  titulaireParDefaut?: string
}

interface Valeurs {
  montant: number
  numero: string
  titulaire: string
  moisExpiration: number
  anneeExpiration: number
  cvv: string
}

const MOIS = Array.from({ length: 12 }, (_, i) => i + 1)
const ANNEES = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i)

/** Groupe les chiffres par 4 pendant la frappe, sans jamais en perdre. */
function formaterNumero(saisie: string): string {
  const chiffres = saisie.replace(/\D/g, '').slice(0, 16)
  return (chiffres.match(/.{1,4}/g) ?? []).join(' ')
}

function ModaleRechargement({
  open,
  onClose,
  onSucces,
  titulaireParDefaut,
}: ModaleRechargementProps) {
  const [form] = Form.useForm<Valeurs>()
  const [envoi, setEnvoi] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)
  const [banques, setBanques] = useState<BanqueAcceptee[]>([])

  const numero = Form.useWatch('numero', form) ?? ''
  const titulaire = Form.useWatch('titulaire', form) ?? ''
  const mois = Form.useWatch('moisExpiration', form)
  const annee = Form.useWatch('anneeExpiration', form)

  useEffect(() => {
    if (!open) return
    void getBanquesAcceptees()
      .then(setBanques)
      .catch(() => undefined)
  }, [open])

  // Reconnaissance locale de la banque dès le 6e chiffre, pour éviter au
  // client de découvrir au moment de valider que sa carte n'est pas acceptée.
  // Le serveur reste seul juge : ceci n'est qu'un retour visuel.
  const indiceBanque = useMemo(() => {
    const bin = numero.replace(/\D/g, '').slice(0, 6)
    if (bin.length < 6) return null
    return banques.find((b) => b.bin === bin)?.banque ?? null
  }, [numero, banques])

  async function handleSubmit(valeurs: Valeurs) {
    setRefus(null)
    setEnvoi(true)

    try {
      const resultat = await rechargerParCarte({
        montant: valeurs.montant,
        numero: valeurs.numero,
        titulaire: valeurs.titulaire,
        moisExpiration: valeurs.moisExpiration,
        anneeExpiration: valeurs.anneeExpiration,
        cvv: valeurs.cvv,
      })

      onSucces(resultat)
      form.resetFields()
      message.success(
        resultat.facturesReglees > 0
          ? `Rechargement accepté. ${resultat.facturesReglees} facture(s) réglée(s) automatiquement.`
          : 'Rechargement accepté.',
      )
      onClose()
    } catch (error: unknown) {
      // Un refus d'autorisation est une réponse métier, pas une panne : le
      // motif renvoyé par la banque simulée s'affiche dans le formulaire.
      const reponse =
        error && typeof error === 'object' && 'response' in error
          ? (error.response as { data?: { paiement?: { motifRefus?: string }; message?: string } })?.data
          : undefined

      setRefus(
        reponse?.paiement?.motifRefus ??
          reponse?.message ??
          'Le paiement n’a pas abouti. Vérifiez les informations saisies.',
      )
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Modal
      title="Recharger mon porte-monnaie"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnHidden
    >
      <CarteVisuelle
        numero={numero}
        titulaire={titulaire}
        moisExpiration={mois}
        anneeExpiration={annee}
        banque={indiceBanque}
      />

      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        style={{ marginBottom: 16 }}
        message="Paiement simulé"
        description={
          <>
            Aucun argent ne circule et aucune banque n’est contactée. Seuls les
            quatre derniers chiffres sont conservés — ni le numéro complet, ni le
            cryptogramme.
            {banques.length > 0 && (
              <div style={{ marginTop: 6 }}>
                Cartes acceptées : {banques.map((b) => b.banque).join(', ')}.
              </div>
            )}
          </>
        }
      />

      {refus && (
        <Alert type="error" showIcon message={refus} style={{ marginBottom: 16 }} />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => void handleSubmit(v)}
        initialValues={{ montant: 50, titulaire: titulaireParDefaut ?? '' }}
      >
        <Form.Item
          label="Montant à recharger (DT)"
          name="montant"
          rules={[{ required: true, message: 'Indiquez un montant.' }]}
        >
          <InputNumber min={1} step={10} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Numéro de carte"
          name="numero"
          rules={[
            { required: true, message: 'Saisissez le numéro de la carte.' },
            {
              validator: (_, valeur: string) =>
                (valeur ?? '').replace(/\D/g, '').length >= 13
                  ? Promise.resolve()
                  : Promise.reject(new Error('Le numéro comporte au moins 13 chiffres.')),
            },
          ]}
          normalize={formaterNumero}
        >
          <Input
            prefix={<CreditCardOutlined />}
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label="Titulaire"
          name="titulaire"
          rules={[{ required: true, message: 'Indiquez le nom du titulaire.' }]}
        >
          <Input placeholder="NOM PRÉNOM" autoComplete="off" />
        </Form.Item>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            label="Mois"
            name="moisExpiration"
            rules={[{ required: true, message: 'Mois requis.' }]}
            style={{ flex: 1 }}
          >
            <Select
              placeholder="MM"
              options={MOIS.map((m) => ({ label: String(m).padStart(2, '0'), value: m }))}
            />
          </Form.Item>

          <Form.Item
            label="Année"
            name="anneeExpiration"
            rules={[{ required: true, message: 'Année requise.' }]}
            style={{ flex: 1 }}
          >
            <Select placeholder="AAAA" options={ANNEES.map((a) => ({ label: String(a), value: a }))} />
          </Form.Item>

          <Form.Item
            label="Cryptogramme"
            name="cvv"
            rules={[{ required: true, pattern: /^\d{3,4}$/, message: '3 ou 4 chiffres.' }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="123" maxLength={4} inputMode="numeric" autoComplete="off" />
          </Form.Item>
        </div>

        <Button type="primary" htmlType="submit" block size="large" loading={envoi}>
          Payer
        </Button>
      </Form>
    </Modal>
  )
}

export default ModaleRechargement
