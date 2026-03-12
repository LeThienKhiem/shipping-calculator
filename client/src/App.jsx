import { useState, useRef, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE.replace(/\/$/, '')}${p}` : `/api${p}`
}

const PORTS = [
  { label: "Haiphong, VN", id: "P_19845" },
  { label: "Los Angeles, US", id: "P_15786" },
  { label: "Dubai, AE", id: "P_506" },
]

const QUICK_PORTS = [
  { id: "P_19845", label: "Haiphong", flag: "🇻🇳" },
  { id: "P_15786", label: "Los Angeles", flag: "🇺🇸" },
  { id: "P_506", label: "Dubai", flag: "🇦🇪" },
]

const SHIPPING_TYPES = ['FCL', 'LCL', 'AIR', 'FTL', 'LTL', 'BULK', 'RAIL_FCL']
const CONTAINERS = ['ST20', 'ST40', 'HC40', 'HC20', 'REF20', 'REF40', 'OT20', 'OT40']
const CONTAINER_SHIPPING = ['FCL', 'RAIL_FCL']
const WEIGHT_SHIPPING = ['LCL', 'AIR', 'FTL', 'LTL']

const today = new Date().toISOString().slice(0, 10)

const glassCard = {
  background: 'rgba(255,255,255,0.05)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
}

// Animated pulse skeleton
function SkeletonCard() {
  return (
    <div
      style={{
        ...glassCard,
        padding: 24,
        marginBottom: 16,
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
      }}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 120, height: 40, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }} />
        <div style={{ flex: 1, minWidth: 100, height: 24, background: 'rgba(255,255,255,0.08)', borderRadius: 6 }} />
        <div style={{ width: 100, height: 32, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }} />
      </div>
    </div>
  )
}

// Route visualization: dots + line
function RouteViz({ fromName, toName }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{fromName}</span>
      </div>
      <div style={{ flex: '0 0 24px', height: 2, background: 'linear-gradient(90deg, #3b82f6, rgba(255,255,255,0.2))', borderRadius: 1 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{toName}</span>
      </div>
    </div>
  )
}

function RateCard({ general, points, portFromLabel, portToLabel, expanded, onToggle, index }) {
  const fromName = points?.[0]?.location?.name || portFromLabel
  const toName = points?.[points?.length - 1]?.location?.name || portToLabel
  const provider = points?.[0]?.provider || '—'
  const transitDays = general?.totalTransitTime ?? points?.[0]?.transitTime?.rate ?? null
  const price = general?.totalPrice ?? points?.[0]?.totalPrice
  const currency = general?.totalCurrency ?? points?.[0]?.totalCurrency ?? 'USD'
  const validityFrom = general?.validityFrom
  const validityTo = general?.validityTo

  const pointsArray = Array.isArray(points) ? points : []
  const allTariffRows = []
  pointsArray.forEach((pt) => {
    allTariffRows.push(...(Array.isArray(pt.routeTariff) ? pt.routeTariff : []).map((t) => ({ type: 'Route', point: pt.location?.name, ...t })))
    allTariffRows.push(...(Array.isArray(pt.pointTariff) ? pt.pointTariff : []).map((t) => ({ type: 'Point', point: pt.location?.name, ...t })))
  })

  return (
    <div
      onClick={onToggle}
      style={{
        ...glassCard,
        padding: 20,
        marginBottom: 16,
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        animation: 'cardFadeIn 0.4s ease forwards',
        animationDelay: `${index * 0.05}s`,
        opacity: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
        {/* Left: route viz */}
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <RouteViz fromName={fromName} toName={toName} />
        </div>
        {/* Center: carrier, transit, validity */}
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>{provider}</div>
          {transitDays != null && (
            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.2)', color: '#3b82f6', fontSize: 12, fontWeight: 500 }}>
              {transitDays} days
            </span>
          )}
          {(validityFrom || validityTo) && (
            <div style={{ color: '#64748b', fontSize: 12 }}>
              Validity: {validityFrom || '—'} to {validityTo || '—'}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {general?.indicative && <span style={{ background: '#eab308', color: '#0f172a', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>Indicative</span>}
            {general?.spot && <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>Spot</span>}
            {general?.expired && <span style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>Expired</span>}
            {general?.spaceGuarantee && <span style={{ background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>Space Guarantee</span>}
          </div>
        </div>
        {/* Right: price */}
        <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
          <div style={{ color: '#10b981', fontWeight: 700, fontSize: 24 }}>
            {price != null ? `${currency} ${Number(price).toLocaleString()}` : '—'}
          </div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>per container</div>
        </div>
      </div>
      {expanded && allTariffRows.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Tariff breakdown</div>
          <div style={{ overflow: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>Name</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>Price</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 500 }}>Currency</th>
                </tr>
              </thead>
              <tbody>
                {allTariffRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{row.type}</td>
                    <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{row.name || row.abbr}</td>
                    <td style={{ padding: '8px 12px', color: '#10b981', textAlign: 'right' }}>{row.price != null ? Number(row.price).toLocaleString() : '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{row.currency || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

function PortSearch({ label, value, onChange }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResult, setSearchResult] = useState({ cities: [], ports: [] })
  const [cityPorts, setCityPorts] = useState(null)
  const [cityPortsLoading, setCityPortsLoading] = useState(false)
  const [pickedPlaceId, setPickedPlaceId] = useState(null)
  const containerRef = useRef(null)
  const debouncedQuery = useDebounce(input.trim(), 400)

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setSearchResult({ cities: [], ports: [] })
      return
    }
    let cancelled = false
    setSearchLoading(true)
    fetch(apiUrl(`/search?q=${encodeURIComponent(debouncedQuery)}`))
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSearchResult({ cities: data.cities ?? [], ports: data.ports ?? [] })
      })
      .catch(() => { if (!cancelled) setSearchResult({ cities: [], ports: [] }) })
      .finally(() => { if (!cancelled) setSearchLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleCityClick(city) {
    if (!city.place_id) return
    setPickedPlaceId(city.place_id)
    setCityPortsLoading(true)
    setCityPorts(null)
    try {
      const r = await fetch(apiUrl(`/geocode?place_id=${encodeURIComponent(city.place_id)}`))
      const data = await r.json()
      setCityPorts(data.ports ?? [])
    } catch {
      setCityPorts([])
    } finally {
      setCityPortsLoading(false)
    }
  }

  function handlePortSelect(port) {
    onChange({ id: port.id, name: port.name || port.label, unlocode: port.unlocode || '' })
    setOpen(false)
    setInput('')
    setSearchResult({ cities: [], ports: [] })
    setCityPorts(null)
    setPickedPlaceId(null)
  }

  function handleClear() {
    onChange(null)
    setInput('')
    setCityPorts(null)
    setPickedPlaceId(null)
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(15,23,42,0.6)',
    color: '#e2e8f0',
    fontSize: 14,
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{label}</label>
      {value ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ color: '#e2e8f0' }}>{value.name}{value.unlocode ? ` (${value.unlocode})` : ''}</span>
          <button type="button" onClick={handleClear} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 4px', fontSize: 18, lineHeight: 1 }} aria-label="Clear">×</button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Type 3+ characters to search..."
            style={inputStyle}
          />
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, ...glassCard, padding: 0, maxHeight: 320, overflow: 'auto', zIndex: 20 }}>
              {searchLoading && input.trim().length >= 3 && <div style={{ padding: 12, color: '#94a3b8' }}>Searching...</div>}
              {!searchLoading && input.trim().length >= 3 && (
                <>
                  <div style={{ padding: '8px 12px', color: '#64748b', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>🏙️ Cities</div>
                  {(searchResult.cities || []).map((c, i) => (
                    <div key={c.place_id || i} onClick={() => handleCityClick(c)} style={{ padding: '10px 12px', cursor: 'pointer', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{c.name} {c.country && `· ${c.country}`}</div>
                  ))}
                  <div style={{ padding: '8px 12px', color: '#64748b', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }}>⚓ Nearby ports</div>
                  {(searchResult.ports || []).map((p, i) => (
                    <div key={p.id || i} onClick={() => handlePortSelect(p)} style={{ padding: '10px 12px', cursor: 'pointer', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{p.name} {p.unlocode && `(${p.unlocode})`}</div>
                  ))}
                </>
              )}
              {pickedPlaceId && (
                <>
                  <div style={{ padding: '8px 12px', color: '#64748b', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }}>Ports in this city</div>
                  {cityPortsLoading && <div style={{ padding: 12, color: '#94a3b8' }}>Loading...</div>}
                  {(cityPorts || []).map((p, i) => (
                    <div key={p.id || i} onClick={() => handlePortSelect(p)} style={{ padding: '10px 12px', cursor: 'pointer', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{p.name} {p.unlocode && `(${p.unlocode})`}</div>
                  ))}
                </>
              )}
              {!searchLoading && input.trim().length < 3 && !pickedPlaceId && <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>Type 3+ characters to search</div>}
            </div>
          )}
        </>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {QUICK_PORTS.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => {
              const port = PORTS.find((p) => p.id === q.id)
              onChange(port ? { id: port.id, name: port.label, unlocode: '' } : { id: q.id, name: q.label, unlocode: '' })
              setOpen(false)
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.15)',
              background: value?.id === q.id ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {q.flag} {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [shippingType, setShippingType] = useState('FCL')
  const [portFrom, setPortFrom] = useState(() => {
    const p = PORTS.find((x) => x.id === 'P_19845')
    return p ? { id: p.id, name: p.label, unlocode: '' } : null
  })
  const [portTo, setPortTo] = useState(() => {
    const p = PORTS.find((x) => x.id === 'P_15786')
    return p ? { id: p.id, name: p.label, unlocode: '' } : null
  })
  const [container, setContainer] = useState('ST20')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [sortBy, setSortBy] = useState('price') // 'price' | 'transit'
  const [swapSpin, setSwapSpin] = useState(false)

  const showContainer = CONTAINER_SHIPPING.includes(shippingType)
  const showWeight = WEIGHT_SHIPPING.includes(shippingType)
  const pointIdFrom = portFrom?.id ?? ''
  const pointIdTo = portTo?.id ?? ''
  const portFromLabel = portFrom?.name ?? pointIdFrom
  const portToLabel = portTo?.name ?? pointIdTo

  function handleSwapPorts() {
    setPortFrom(portTo)
    setPortTo(portFrom)
    setSwapSpin(true)
    setTimeout(() => setSwapSpin(false), 400)
  }

  async function handleSearch() {
    setError(null)
    setData(null)
    setLoading(true)
    const params = new URLSearchParams({ shippingType, pointIdFrom, pointIdTo, date })
    if (showContainer) params.set('container', container)
    if (showWeight && weight) params.set('weight', weight)
    try {
      const res = await fetch(apiUrl(`/rates?${params}`))
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || res.statusText)
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const ratesRaw = data?.data?.rates
  const ratesArray = Array.isArray(ratesRaw) ? ratesRaw : (ratesRaw ? [ratesRaw] : [])
  const sortedRates = [...ratesArray].sort((a, b) => {
    if (sortBy === 'price') {
      const priceA = Number(a?.general?.totalPrice ?? a?.points?.[0]?.totalPrice ?? 0)
      const priceB = Number(b?.general?.totalPrice ?? b?.points?.[0]?.totalPrice ?? 0)
      return priceA - priceB
    }
    const daysA = Number(a?.general?.totalTransitTime ?? a?.points?.[0]?.transitTime?.rate ?? 999)
    const daysB = Number(b?.general?.totalTransitTime ?? b?.points?.[0]?.transitTime?.rate ?? 999)
    return daysA - daysB
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px 16px',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes skeletonPulse { 0%,100%{ opacity: 0.6 } 50%{ opacity: 1 } }
        @keyframes cardFadeIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes swapRotate { from { transform: rotate(0deg) } to { transform: rotate(180deg) } }
      `}} />
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Hero */}
        <header style={{ textAlign: 'center', marginBottom: 32, paddingTop: 16 }}>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>
            🌊 SeaRates Logistics Explorer
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16 }}>Compare shipping rates and transit times across carriers</p>
        </header>

        {/* Search form - glass card */}
        <div style={{ ...glassCard, padding: 24, marginBottom: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Row: Port from | Swap | Port to */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <PortSearch label="Port from" value={portFrom} onChange={setPortFrom} />
              </div>
              <button
                type="button"
                onClick={handleSwapPorts}
                aria-label="Swap ports"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#3b82f6',
                  fontSize: 20,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.3s ease, background 0.2s',
                  transform: swapSpin ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ⇄
              </button>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <PortSearch label="Port to" value={portTo} onChange={setPortTo} />
              </div>
            </div>
            {/* Row: Shipping type */}
            <div style={{ maxWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>Shipping type</label>
              <select
                value={shippingType}
                onChange={(e) => setShippingType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(15,23,42,0.6)',
                  color: '#e2e8f0',
                  fontSize: 14,
                }}
              >
                {SHIPPING_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Row: Container + Date (same row) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {showContainer && (
                <div style={{ minWidth: 120 }}>
                  <label style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>Container type</label>
                  <select
                    value={container}
                    onChange={(e) => setContainer(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(15,23,42,0.6)',
                      color: '#e2e8f0',
                      fontSize: 14,
                    }}
                  >
                    {CONTAINERS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div style={{ minWidth: 160 }}>
                <label style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>Cargo ready date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(15,23,42,0.6)',
                    color: '#e2e8f0',
                    fontSize: 14,
                  }}
                />
              </div>
              {showWeight && (
                <div style={{ minWidth: 120 }}>
                  <label style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>Weight (kg)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 500"
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(15,23,42,0.6)',
                      color: '#e2e8f0',
                      fontSize: 14,
                    }}
                  />
                </div>
              )}
            </div>
            {/* Get rates button */}
            <button
              onClick={handleSearch}
              disabled={loading || !portFrom || !portTo}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 9999,
                border: 'none',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
                cursor: loading || !portFrom || !portTo ? 'not-allowed' : 'pointer',
                opacity: loading || !portFrom || !portTo ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? 'Searching rates...' : <><span style={{ fontSize: 18 }}>🔍</span> Get rates</>}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ ...glassCard, padding: 16, marginBottom: 24, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#fecaca' }}>
            {error}
          </div>
        )}

        {loading && (
          <div>
            <div style={{ marginBottom: 12, color: '#94a3b8', fontSize: 14 }}>Loading results...</div>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!loading && data && ratesArray.length === 0 && (
          <div style={{ ...glassCard, padding: 32, textAlign: 'center', color: '#94a3b8' }}>No rate data for this route.</div>
        )}

        {!loading && data && sortedRates.length > 0 && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 18 }}>{sortedRates.length} results found</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSortBy('price')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: sortBy === 'price' ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                    color: '#e2e8f0',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Lowest price
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('transit')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: sortBy === 'transit' ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                    color: '#e2e8f0',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Fastest
                </button>
              </div>
            </div>
            {sortedRates.map((rate, idx) => {
              const general = rate?.general || {}
              const pointsList = Array.isArray(rate?.points) ? rate.points : []
              return (
                <RateCard
                  key={idx}
                  general={general}
                  points={pointsList}
                  portFromLabel={portFromLabel}
                  portToLabel={portToLabel}
                  expanded={expandedId === idx}
                  onToggle={() => setExpandedId((e) => (e === idx ? null : idx))}
                  index={idx}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
