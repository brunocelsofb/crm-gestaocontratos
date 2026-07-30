type Snapshot = {
  clientName: string
  projectName: string
  tipoEngenharia: string
  hospitalBeds: number
  escopoServicos: string[]
  professionals: {
    role: string
    quantity: number
    contractType: string
    hoursPerMonth: number
    dedication?: number
  }[]
  totalFTE: number
  cltCount: number
  pjCount: number
  sentAt: string
}

export function TechnicalDocument({ snapshot, showFinancials }: {
  snapshot: Snapshot
  showFinancials: boolean
}) {
  const s: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary, #8892a4)' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: 10, border: '0.5px solid #e8edf5', padding: 16, marginBottom: 12 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Capa */}
      <div style={{ ...card, background: 'linear-gradient(135deg,#1b556b,#32af9d)', color: '#fff', padding: '24px 20px' }}>
        <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
          Proposta Técnica — {snapshot.tipoEngenharia}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 4px', color: '#fff' }}>{snapshot.clientName}</h2>
        <p style={{ fontSize: 13, opacity: 0.85, margin: '0 0 16px' }}>{snapshot.projectName}</p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {snapshot.hospitalBeds > 0 && (
            <div>
              <p style={{ fontSize: 10, opacity: 0.7, margin: 0 }}>LEITOS</p>
              <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: '#fff' }}>{snapshot.hospitalBeds}</p>
            </div>
          )}
          <div>
            <p style={{ fontSize: 10, opacity: 0.7, margin: 0 }}>PROFISSIONAIS</p>
            <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: '#fff' }}>{snapshot.totalFTE}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, opacity: 0.7, margin: 0 }}>TIPO</p>
            <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: '#fff' }}>{snapshot.tipoEngenharia}</p>
          </div>
        </div>
        <p style={{ fontSize: 10, opacity: 0.5, margin: '12px 0 0' }}>
          Gerado em {new Date(snapshot.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Equipe */}
      <div style={card}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 12 }}>👥 Dimensionamento de Equipe</p>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: '10px 14px' }}>
            <p style={s}>Total de profissionais</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#1a1f36', margin: 0 }}>{snapshot.totalFTE}</p>
          </div>
          {snapshot.cltCount > 0 && (
            <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: '10px 14px' }}>
              <p style={s}>Regime CLT</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: '#1a1f36', margin: 0 }}>{snapshot.cltCount}</p>
            </div>
          )}
          {snapshot.pjCount > 0 && (
            <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: '10px 14px' }}>
              <p style={s}>Regime PJ</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: '#1a1f36', margin: 0 }}>{snapshot.pjCount}</p>
            </div>
          )}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #e8edf5' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>Função</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>Qtd</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>Regime</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>H/mês</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.professionals.map((p, i) => (
              <tr key={i} style={{ borderBottom: '0.5px solid #f1f3f8' }}>
                <td style={{ padding: '7px 8px', color: '#1a1f36' }}>{p.role}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center', color: '#1a1f36', fontWeight: 500 }}>{p.quantity}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11,
                    background: p.contractType === 'CLT' ? '#eef3ff' : '#f1f3f8',
                    color: p.contractType === 'CLT' ? '#3b5bdb' : '#52514e' }}>
                    {p.contractType}
                  </span>
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', color: '#52514e' }}>{p.hoursPerMonth}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Escopo de serviços */}
      {snapshot.escopoServicos && snapshot.escopoServicos.length > 0 && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 12 }}>🔧 Escopo de Serviços</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {snapshot.escopoServicos.map((s, i) => (
              <span key={i} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, background: '#eaf5ee', color: '#1a7c3e', border: '0.5px solid #bbddc8' }}>
                ✓ {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Valor — só para admin/comercial */}
      {showFinancials && (
        <div style={{ ...card, background: '#f8f9fb' }}>
          <p style={{ fontSize: 11, color: '#8892a4', margin: '0 0 4px' }}>⚠ Visível apenas para aprovadores comerciais e admins</p>
          <p style={{ fontSize: 12, color: '#b0b8c8', margin: 0 }}>O valor financeiro está disponível na seção de status acima.</p>
        </div>
      )}
    </div>
  )
}
