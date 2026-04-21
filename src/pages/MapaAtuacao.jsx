import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import shp from 'shpjs'
import { supabase } from '../lib/supabase'

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CORES_PADRAO = [
  '#2d7a4f','#1d4ed8','#b45309','#7c3aed','#dc2626',
  '#0f766e','#be185d','#92400e','#1e40af','#065f46',
]

// ── Componente auxiliar para zoom numa camada ─────────────────────────────────
function ZoomParaCamada({ geojson, trigger }) {
  const map = useMap()
  useEffect(() => {
    if (!geojson || !trigger) return
    try {
      const layer = L.geoJSON(geojson)
      const bounds = layer.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] })
    } catch {}
  }, [trigger])
  return null
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function MapaAtuacao() {
  const [camadas,      setCamadas]      = useState([])
  const [carregando,   setCarregando]   = useState(true)
  const [importando,   setImportando]   = useState(false)
  const [zoomTarget,   setZoomTarget]   = useState(null)
  const [editandoNome, setEditandoNome] = useState(null)
  const [novoNome,     setNovoNome]     = useState('')
  const [mapaReady,    setMapaReady]    = useState(false)
  const inputRef = useRef()

  // ── Carregar camadas salvas ───────────────────────────────────────────────
  const carregar = async () => {
    setCarregando(true)
    const { data } = await supabase.from('mapa_camadas').select('*').order('created_at')
    setCamadas(data || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  // ── Importar shapefile ────────────────────────────────────────────────────
  const importarShapefile = async (arquivo) => {
    if (!arquivo) return
    setImportando(true)
    try {
      const buffer  = await arquivo.arrayBuffer()
      const geojson = await shp(buffer)

      // shpjs pode retornar FeatureCollection ou array delas
      const colecoes = Array.isArray(geojson) ? geojson : [geojson]

      for (const colecao of colecoes) {
        if (!colecao?.features?.length) continue

        const nomeSugerido = arquivo.name.replace(/\.zip$/i, '')
        const cor = CORES_PADRAO[camadas.length % CORES_PADRAO.length]
        const userId = (await supabase.auth.getUser()).data.user?.id

        const { data, error } = await supabase.from('mapa_camadas').insert({
          nome:       nomeSugerido,
          cor,
          visivel:    true,
          geojson:    colecao,
          usuario_id: userId,
        }).select().single()

        if (!error && data) {
          setCamadas(prev => [...prev, data])
          // zoom automático para a nova camada
          setTimeout(() => setZoomTarget({ id: data.id, geojson: colecao }), 300)
        }
      }
    } catch (e) {
      alert(`Erro ao importar shapefile: ${e.message}\n\nCertifique-se de enviar um .zip contendo os arquivos .shp, .dbf e .prj.`)
    }
    setImportando(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Toggle visibilidade ───────────────────────────────────────────────────
  const toggleVisivel = async (id, atual) => {
    await supabase.from('mapa_camadas').update({ visivel: !atual }).eq('id', id)
    setCamadas(prev => prev.map(c => c.id === id ? { ...c, visivel: !atual } : c))
  }

  // ── Mudar cor ─────────────────────────────────────────────────────────────
  const mudarCor = async (id, cor) => {
    await supabase.from('mapa_camadas').update({ cor }).eq('id', id)
    setCamadas(prev => prev.map(c => c.id === id ? { ...c, cor } : c))
  }

  // ── Remover camada ────────────────────────────────────────────────────────
  const removerCamada = async (id) => {
    if (!confirm('Remover esta camada do mapa?')) return
    await supabase.from('mapa_camadas').delete().eq('id', id)
    setCamadas(prev => prev.filter(c => c.id !== id))
  }

  // ── Renomear camada ───────────────────────────────────────────────────────
  const salvarNome = async (id) => {
    if (!novoNome.trim()) return
    await supabase.from('mapa_camadas').update({ nome: novoNome.trim() }).eq('id', id)
    setCamadas(prev => prev.map(c => c.id === id ? { ...c, nome: novoNome.trim() } : c))
    setEditandoNome(null)
  }

  // ── Zoom para camada ──────────────────────────────────────────────────────
  const zoomParaCamada = (camada) => {
    setZoomTarget({ id: camada.id, geojson: camada.geojson, ts: Date.now() })
  }

  // ── Estilo GeoJSON por camada ─────────────────────────────────────────────
  const estiloParaCamada = useCallback((camada) => () => ({
    color:       camada.cor,
    fillColor:   camada.cor,
    fillOpacity: 0.25,
    weight:      2,
    opacity:     0.85,
  }), [])

  // ── Popup ao clicar numa feature ──────────────────────────────────────────
  const aoClicarFeature = useCallback((feature, layer) => {
    if (!feature.properties) return
    const props = feature.properties
    const linhas = Object.entries(props)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `<tr><td style="padding:3px 8px;font-weight:600;color:#374151;white-space:nowrap">${k}</td><td style="padding:3px 8px;color:#6b7280">${v}</td></tr>`)
      .join('')
    if (linhas) {
      layer.bindPopup(`<div style="font-family:Segoe UI,sans-serif;font-size:13px;max-height:200px;overflow-y:auto"><table style="border-collapse:collapse">${linhas}</table></div>`, { maxWidth: 320 })
    }
  }, [])

  const visiveisCont = camadas.filter(c => c.visivel).length

  return (
    <div style={st.container}>

      {/* ── Painel lateral de camadas ── */}
      <aside style={st.painel}>
        <div style={st.painelHeader}>
          <h3 style={st.painelTitulo}>🗂️ Camadas</h3>
          <span style={st.painelSub}>{visiveisCont}/{camadas.length} visíveis</span>
        </div>

        {/* Botão importar */}
        <div style={st.importarArea}>
          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={e => e.target.files[0] && importarShapefile(e.target.files[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={importando}
            style={st.btnImportar}
          >
            {importando ? (
              <><span style={st.spinner}>⏳</span> Importando...</>
            ) : (
              <>📂 Adicionar Camada (.zip)</>
            )}
          </button>
          <p style={st.dica}>
            Selecione um <strong>.zip</strong> com os arquivos .shp, .dbf e .prj
          </p>
        </div>

        {/* Lista de camadas */}
        <div style={st.listaWrap}>
          {carregando ? (
            <p style={st.msg}>Carregando...</p>
          ) : camadas.length === 0 ? (
            <div style={st.vazio}>
              <p style={{ fontSize: '28px', marginBottom: '8px' }}>🗺️</p>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
                Nenhuma camada ainda.<br />Importe um shapefile para começar.
              </p>
            </div>
          ) : (
            camadas.map(c => (
              <div key={c.id} style={{ ...st.camadaItem, opacity: c.visivel ? 1 : 0.5 }}>

                {/* Cor + nome */}
                <div style={st.camadaTopo}>
                  {/* Seletor de cor */}
                  <label style={{ cursor: 'pointer', flexShrink: 0 }} title="Mudar cor">
                    <input type="color" value={c.cor} onChange={e => mudarCor(c.id, e.target.value)}
                      style={{ width: '22px', height: '22px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }} />
                  </label>

                  {/* Nome (editável ao clicar) */}
                  {editandoNome === c.id ? (
                    <input
                      autoFocus
                      value={novoNome}
                      onChange={e => setNovoNome(e.target.value)}
                      onBlur={() => salvarNome(c.id)}
                      onKeyDown={e => { if (e.key === 'Enter') salvarNome(c.id); if (e.key === 'Escape') setEditandoNome(null) }}
                      style={st.inputNome}
                    />
                  ) : (
                    <span
                      style={st.camadaNome}
                      onClick={() => { setEditandoNome(c.id); setNovoNome(c.nome) }}
                      title="Clique para renomear"
                    >{c.nome}</span>
                  )}
                </div>

                {/* Ações */}
                <div style={st.camadaAcoes}>
                  <button onClick={() => toggleVisivel(c.id, c.visivel)}
                    style={st.btnAcao} title={c.visivel ? 'Ocultar' : 'Mostrar'}>
                    {c.visivel ? '👁️' : '🙈'}
                  </button>
                  <button onClick={() => zoomParaCamada(c)}
                    style={st.btnAcao} title="Zoom para camada">
                    🔍
                  </button>
                  <button onClick={() => removerCamada(c.id)}
                    style={{ ...st.btnAcao, color: '#dc2626' }} title="Remover camada">
                    🗑️
                  </button>
                </div>

                {/* Contagem de features */}
                <span style={st.featCount}>
                  {c.geojson?.features?.length || 0} feature{(c.geojson?.features?.length || 0) !== 1 ? 's' : ''}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Legenda */}
        {camadas.length > 0 && (
          <div style={st.legenda}>
            <p style={st.legendaTitulo}>Legenda</p>
            {camadas.filter(c => c.visivel).map(c => (
              <div key={c.id} style={st.legendaItem}>
                <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: c.cor, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* ── Mapa ── */}
      <div style={st.mapaWrap}>
        <MapContainer
          center={[-10, -55]}
          zoom={4}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          whenReady={() => setMapaReady(true)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ZoomControl position="bottomright" />

          {mapaReady && camadas.filter(c => c.visivel).map(c => (
            <GeoJSON
              key={`${c.id}-${c.cor}-${c.visivel}`}
              data={c.geojson}
              style={estiloParaCamada(c)}
              onEachFeature={aoClicarFeature}
            />
          ))}

          {zoomTarget && (
            <ZoomParaCamada
              geojson={zoomTarget.geojson}
              trigger={zoomTarget.ts || zoomTarget.id}
            />
          )}
        </MapContainer>

        {/* Dica flutuante */}
        {camadas.length === 0 && !carregando && (
          <div style={st.dicaFlutuante}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              👈 Importe um shapefile no painel lateral para visualizar no mapa
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const st = {
  container: {
    display: 'flex', gap: '0', height: 'calc(100vh - 180px)',
    minHeight: '500px', background: '#fff', borderRadius: '12px',
    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
  },
  painel: {
    width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #e5e7eb', background: '#fafafa', overflow: 'hidden',
  },
  painelHeader: {
    padding: '16px 16px 8px', borderBottom: '1px solid #e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  painelTitulo: { fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 },
  painelSub:    { fontSize: '11px', color: '#9ca3af' },
  importarArea: { padding: '12px 14px', borderBottom: '1px solid #e5e7eb' },
  btnImportar: {
    width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px dashed #2d7a4f',
    background: '#f0fdf4', color: '#1a4731', cursor: 'pointer', fontSize: '13px',
    fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', transition: 'all 0.2s',
  },
  dica: { fontSize: '11px', color: '#9ca3af', margin: '6px 0 0 0', textAlign: 'center' },
  spinner: { animation: 'spin 1s linear infinite', display: 'inline-block' },
  listaWrap: {
    flex: 1, overflowY: 'auto', padding: '8px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  msg: { textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '24px' },
  vazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '24px' },
  camadaItem: {
    background: '#fff', borderRadius: '8px', padding: '10px 12px',
    border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '6px',
    transition: 'opacity 0.2s',
  },
  camadaTopo: { display: 'flex', alignItems: 'center', gap: '8px' },
  camadaNome: {
    flex: 1, fontSize: '13px', fontWeight: '600', color: '#111827',
    cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    borderBottom: '1px dashed transparent',
  },
  inputNome: {
    flex: 1, fontSize: '13px', fontWeight: '600', color: '#111827',
    border: '1.5px solid #2d7a4f', borderRadius: '4px', padding: '2px 6px', outline: 'none',
  },
  camadaAcoes: { display: 'flex', gap: '4px' },
  btnAcao: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px',
    padding: '2px 4px', borderRadius: '4px', lineHeight: 1,
  },
  featCount: { fontSize: '10px', color: '#9ca3af' },
  legenda: {
    borderTop: '1px solid #e5e7eb', padding: '10px 14px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  legendaTitulo: { fontSize: '11px', fontWeight: '700', color: '#9ca3af', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' },
  legendaItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  mapaWrap: { flex: 1, position: 'relative', minHeight: '0' },
  dicaFlutuante: {
    position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(255,255,255,0.95)', borderRadius: '10px', padding: '12px 20px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 1000, pointerEvents: 'none',
    border: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  },
}
