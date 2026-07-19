'use client'

type Option = { id: string; name: string }

export function CarteiraSelectFilters({
  coords, engs, currentCoord, currentEng, baseUrl
}: {
  coords: Option[]
  engs: Option[]
  currentCoord?: string
  currentEng?: string
  baseUrl: string
}) {
  return (
    <>
      <select
        defaultValue={currentCoord ?? ''}
        onChange={e => {
          const url = new URL(window.location.href)
          if (e.target.value) url.searchParams.set('coord', e.target.value)
          else url.searchParams.delete('coord')
          window.location.href = url.toString()
        }}
        style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>
        <option value="">Todos os coordenadores</option>
        {coords.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select
        defaultValue={currentEng ?? ''}
        onChange={e => {
          const url = new URL(window.location.href)
          if (e.target.value) url.searchParams.set('eng', e.target.value)
          else url.searchParams.delete('eng')
          window.location.href = url.toString()
        }}
        style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>
        <option value="">Todos os engenheiros</option>
        {engs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
    </>
  )
}
