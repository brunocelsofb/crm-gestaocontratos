type Professional = {
  role: string
  quantity: number
  contractType: string
  hoursPerMonth: number
  dedication?: number
}

type Dimensionamento = {
  totalEquipamentos: number
  horasMensaisDemandadas: number
  fteDemandado: number
  fteArredondado: number
  hhLiquidoMes: number
  porComplexidade: { label: string; qty: number; mp: number; mc: number; calib: number; ee: number; qd: number; total: number }[]
  familias: { familia: string; qty: number; complexidade: string; horasMes: number }[]
  escopo: string[]
}

type Snapshot = {
  clientName: string
  projectName: string
  tipoEngenharia: string
  hospitalBeds: number
  escopoServicos: string[]
  professionals: Professional[]
  totalFTE: number
  cltCount: number
  pjCount: number
  dimensionamento?: Dimensionamento
  sentAt: string
}

const h2 = (s: string) => `Horas ${s}/ano`

export function TechnicalDocument({ snapshot, showFinancials }: {
  snapshot: Snapshot
  showFinancials: boolean
}) {
  const card: React.CSSProperties = { background: '#fff', borderRadius: 10, border: '0.5px solid #e8edf5', padding: 16, marginBottom: 12 }
  const muted: React.CSSProperties = { fontSize: 11, color: '#8892a4' }
  const label: React.CSSProperties = { fontSize: 10, color: '#8892a4', textTransform: 'uppercase' as const, letterSpacing: '0.6px', margin: '0 0 2px' }
  const value: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: '#1a1f36', margin: 0 }
  const dim = snapshot.dimensionamento

  const fmtH = (h: number) => h > 0 ? `${Math.round(h)}h` : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Capa */}
      <div style={{ ...card, background: 'linear-gradient(135deg,#1b556b,#32af9d)', padding: '24px 20px', marginBottom: 12 }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>
          Proposta Técnica — {snapshot.tipoEngenharia}
        </p>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 2px', color: '#fff' }}>{snapshot.clientName}</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '0 0 16px' }}>{snapshot.projectName}</p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {snapshot.hospitalBeds > 0 && (
            <div><p style={{ ...label, color: 'rgba(255,255,255,0.6)' }}>Leitos</p><p style={{ ...value, color: '#fff' }}>{snapshot.hospitalBeds}</p></div>
          )}
          {dim && (
            <div><p style={{ ...label, color: 'rgba(255,255,255,0.6)' }}>Equipamentos</p><p style={{ ...value, color: '#fff' }}>{dim.totalEquipamentos}</p></div>
          )}
          <div><p style={{ ...label, color: 'rgba(255,255,255,0.6)' }}>Profissionais</p><p style={{ ...value, color: '#fff' }}>{snapshot.totalFTE}</p></div>
          {dim && (
            <div><p style={{ ...label, color: 'rgba(255,255,255,0.6)' }}>FTE Demandado</p><p style={{ ...value, color: '#fff' }}>{dim.fteDemandado}</p></div>
          )}
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '12px 0 0' }}>
          Gerado em {new Date(snapshot.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Dimensionamento por complexidade */}
      {dim && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: '0 0 12px' }}>📊 Dimensionamento por Complexidade</p>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
              <p style={label}>Total equipamentos</p>
              <p style={value}>{dim.totalEquipamentos}</p>
            </div>
            <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
              <p style={label}>Horas/mês demandadas</p>
              <p style={value}>{fmtH(dim.horasMensaisDemandadas)}</p>
            </div>
            <div style={{ background: '#eef3ff', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ ...label, color: '#3b5bdb' }}>FTE demandado</p>
              <p style={{ ...value, color: '#3b5bdb' }}>{dim.fteDemandado}</p>
            </div>
            <div style={{ background: '#eaf5ee', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ ...label, color: '#1a7c3e' }}>FTE alocado</p>
              <p style={{ ...value, color: '#1a7c3e' }}>{dim.fteArredondado}</p>
            </div>
          </div>
          <p style={{ ...muted, marginBottom: 8 }}>Base: {dim.hhLiquidoMes}h líquidas/mês por técnico (produtividade 70%, absenteísmo 10%)</p>

          {/* Tabela por complexidade */}
          {dim.porComplexidade.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid #e8edf5' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>Complexidade</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>Qtd</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>MP</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>MC</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>Calib</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#8892a4', fontWeight: 500 }}>Total/ano</th>
                </tr>
              </thead>
              <tbody>
                {dim.porComplexidade.map((g, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #f1f3f8' }}>
                    <td style={{ padding: '7px 8px', color: '#1a1f36', fontWeight: 500 }}>{g.label}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: '#52514e' }}>{g.qty}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: '#52514e' }}>{fmtH(g.mp)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: '#52514e' }}>{fmtH(g.mc)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: '#52514e' }}>{fmtH(g.calib)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#1a1f36', fontWeight: 500 }}>{fmtH(g.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Famílias de equipamento */}
      {dim && dim.familias.length > 0 && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: '0 0 12px' }}>🏥 Inventário por Família</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid #e8edf5' }}>
                <th style={{ textAlign: 'left', padding: '5px 8px', color: '#8892a4', fontWeight: 500 }}>Família</th>
                <th style={{ textAlign: 'center', padding: '5px 8px', color: '#8892a4', fontWeight: 500 }}>Qtd</th>
                <th style={{ textAlign: 'center', padding: '5px 8px', color: '#8892a4', fontWeight: 500 }}>Complexidade</th>
                <th style={{ textAlign: 'right', padding: '5px 8px', color: '#8892a4', fontWeight: 500 }}>H/mês</th>
              </tr>
            </thead>
            <tbody>
              {dim.familias.map((f, i) => (
                <tr key={i} style={{ borderBottom: '0.5px solid #f1f3f8' }}>
                  <td style={{ padding: '6px 8px', color: '#1a1f36' }}>{f.familia}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#52514e' }}>{f.qty}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10,
                      background: f.complexidade === 'Alta' ? '#fdecea' : f.complexidade === 'Baixa' ? '#eaf5ee' : '#fff8e6',
                      color: f.complexidade === 'Alta' ? '#b91c1c' : f.complexidade === 'Baixa' ? '#1a7c3e' : '#92400e' }}>
                      {f.complexidade}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#52514e' }}>{fmtH(f.horasMes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Equipe do projeto */}
      <div style={card}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: '0 0 12px' }}>👥 Equipe do Projeto</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: '8px 12px' }}>
            <p style={label}>Total</p><p style={value}>{snapshot.totalFTE}</p>
          </div>
          {snapshot.cltCount > 0 && (
            <div style={{ flex: 1, background: '#eef3ff', borderRadius: 8, padding: '8px 12px' }}>
              <p style={{ ...label, color: '#3b5bdb' }}>CLT</p><p style={{ ...value, color: '#3b5bdb' }}>{snapshot.cltCount}</p>
            </div>
          )}
          {snapshot.pjCount > 0 && (
            <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: '8px 12px' }}>
              <p style={label}>PJ</p><p style={value}>{snapshot.pjCount}</p>
            </div>
          )}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #e8edf5' }}>
              <th style={{ textAlign: 'left', padding: '5px 8px', color: '#8892a4', fontWeight: 500 }}>Função</th>
              <th style={{ textAlign: 'center', padding: '5px 8px', color: '#8892a4', fontWeight: 500 }}>Qtd</th>
              <th style={{ textAlign: 'center', padding: '5px 8px', color: '#8892a4', fontWeight: 500 }}>Regime</th>
              <th style={{ textAlign: 'right', padding: '5px 8px', color: '#8892a4', fontWeight: 500 }}>H/mês</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.professionals.map((p, i) => (
              <tr key={i} style={{ borderBottom: '0.5px solid #f1f3f8' }}>
                <td style={{ padding: '6px 8px', color: '#1a1f36' }}>{p.role}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 500, color: '#1a1f36' }}>{p.quantity}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10,
                    background: p.contractType === 'CLT' ? '#eef3ff' : '#f1f3f8',
                    color: p.contractType === 'CLT' ? '#3b5bdb' : '#52514e' }}>
                    {p.contractType}
                  </span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#52514e' }}>{p.hoursPerMonth}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Escopo */}
      {(dim?.escopo ?? snapshot.escopoServicos ?? []).length > 0 && (
        <div style={card}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: '0 0 12px' }}>🔧 Escopo de Serviços</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(dim?.escopo ?? snapshot.escopoServicos ?? []).map((s: string, i: number) => (
              <span key={i} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, background: '#eaf5ee', color: '#1a7c3e', border: '0.5px solid #bbddc8' }}>
                ✓ {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Aviso para aprovador técnico */}
      {!showFinancials && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f8f9fb', fontSize: 12, color: '#8892a4', border: '0.5px solid #e8edf5' }}>
          💡 Sua aprovação é sobre a viabilidade técnica e operacional. Os valores comerciais são gerenciados pela equipe comercial.
        </div>
      )}
    </div>
  )
}
