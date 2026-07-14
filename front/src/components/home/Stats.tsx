import './Stats.css'

const stats = [
  { value: '1 200+', label: 'Bornes gérées' },
  { value: '340', label: 'Sessions aujourd’hui' },
  { value: '18,4 MWh', label: 'Énergie délivrée / jour' },
  { value: '99,9 %', label: 'Disponibilité réseau' },
]

function Stats() {
  return (
    <section className="stats" id="supervision">
      <div className="container stats__grid">
        {stats.map((s) => (
          <div className="stats__item" key={s.label}>
            <span className="stats__value">{s.value}</span>
            <span className="stats__label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Stats
