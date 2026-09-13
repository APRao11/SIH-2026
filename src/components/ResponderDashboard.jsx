import { useEffect, useState } from 'react'
import { AlertCircle, Check, Clock3, Image, MapPin, Navigation, Radio, RefreshCw, ShieldAlert, UserCheck, X } from 'lucide-react'
import EmergencyMap from './EmergencyMap'

export default function ResponderDashboard({ responder }) {
  const [respondersList, setRespondersList] = useState([])
  const [currentResponder, setCurrentResponder] = useState(responder || null)
  const [available, setAvailable] = useState(Boolean(responder?.available))
  const [emergencies, setEmergencies] = useState([])
  const [activeTab, setActiveTab] = useState('incoming') // 'incoming' | 'accepted' | 'rejected'
  const [actionMessage, setActionMessage] = useState(null)
  const [locationWarning, setLocationWarning] = useState('')
  const [loadingAction, setLoadingAction] = useState(null)

  const responderId = currentResponder?.id || responder?.id || Number(localStorage.getItem('responderId')) || 0

  // Load available verified responders to allow testing & seamless login persistence
  useEffect(() => {
    async function fetchResponders() {
      try {
        const response = await fetch('/api/responders')
        const result = await response.json()
        if (response.ok && Array.isArray(result.responders)) {
          setRespondersList(result.responders)
          const storedId = Number(localStorage.getItem('responderId'))
          const matched = result.responders.find((r) => r.id === (responder?.id || storedId))
          if (matched) {
            setCurrentResponder(matched)
            setAvailable(Boolean(matched.available))
          } else if (!currentResponder && result.responders.some((r) => r.verified)) {
            const firstVerified = result.responders.find((r) => r.verified)
            if (firstVerified) {
              setCurrentResponder(firstVerified)
              setAvailable(Boolean(firstVerified.available))
              localStorage.setItem('responderId', String(firstVerified.id))
            }
          }
        }
      } catch {
        // Ignored in background
      }
    }
    fetchResponders()
  }, [responder?.id])

  async function updateServerLocation(latitude, longitude, targetId) {
    const id = targetId || responderId
    if (!id) return false
    try {
      const response = await fetch(`/api/responders/${id}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      })
      const result = await response.json()
      if (!response.ok) {
        setLocationWarning(result.error || 'Could not update location on server.')
        return false
      }
      setLocationWarning('')
      return true
    } catch {
      setLocationWarning('Failed to sync location with server.')
      return false
    }
  }

  async function load(latitude, longitude, targetId) {
    const id = targetId || responderId
    if (!id) return
    const locationQuery =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? `&latitude=${latitude}&longitude=${longitude}`
        : ''
    try {
      const response = await fetch(`/api/responder/emergencies?responder_id=${id}${locationQuery}`)
      const result = await response.json()
      if (response.ok) {
        setEmergencies(result.emergencies || [])
        if (result.message && (!result.emergencies || result.emergencies.length === 0)) {
          setLocationWarning(result.message)
        } else {
          setLocationWarning('')
        }
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Failed to fetch emergencies.' })
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to connect to emergency service.' })
    }
  }

  function getAndSyncLocation(onSuccess, onError, targetId) {
    if (!navigator.geolocation) {
      setLocationWarning('Geolocation is not supported by your browser. Location is required for nearby emergency matching.')
      if (onError) onError()
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        await updateServerLocation(coords.latitude, coords.longitude, targetId)
        if (onSuccess) onSuccess(coords.latitude, coords.longitude)
      },
      (error) => {
        setLocationWarning('Location access is required for nearby emergency matching. Please enable location in your browser.')
        if (onError) onError(error)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    )
  }

  useEffect(() => {
    if (!responderId) return
    if (available) {
      getAndSyncLocation(
        (lat, lng) => load(lat, lng),
        () => load()
      )
    } else {
      load()
    }
  }, [responderId])

  useEffect(() => {
    if (!responderId || !available) return
    const interval = window.setInterval(() => {
      getAndSyncLocation(
        (lat, lng) => load(lat, lng),
        () => load()
      )
    }, 15000)
    return () => window.clearInterval(interval)
  }, [responderId, available])

  function handleSelectResponder(e) {
    const selectedId = Number(e.target.value)
    const matched = respondersList.find((r) => r.id === selectedId)
    if (matched) {
      setCurrentResponder(matched)
      setAvailable(Boolean(matched.available))
      localStorage.setItem('responderId', String(matched.id))
      load(undefined, undefined, matched.id)
    }
  }

  async function toggleAvailability() {
    if (!responderId) return
    const next = !available
    if (next) {
      getAndSyncLocation(
        async (lat, lng) => {
          const response = await fetch(`/api/responders/${responderId}/availability`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ available: true }),
          })
          const result = await response.json()
          if (!response.ok) {
            setActionMessage({ type: 'error', text: result.error })
          } else {
            setAvailable(true)
            load(lat, lng)
          }
        },
        async () => {
          const response = await fetch(`/api/responders/${responderId}/availability`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ available: true }),
          })
          const result = await response.json()
          if (!response.ok) setActionMessage({ type: 'error', text: result.error })
          else {
            setAvailable(true)
            load()
          }
        }
      )
    } else {
      const response = await fetch(`/api/responders/${responderId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: false }),
      })
      const result = await response.json()
      if (!response.ok) setActionMessage({ type: 'error', text: result.error })
      else {
        setAvailable(false)
        setEmergencies([])
      }
    }
  }

  async function decide(id, action) {
    setLoadingAction(id)
    const endpoint = action === 'accept' ? 'accept' : 'reject'
    const body = { responder_id: responderId }
    try {
      const response = await fetch(`/api/emergencies/${id}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) {
        setActionMessage({ type: 'error', text: result.error || 'Failed to update response.' })
      } else {
        if (action === 'accept') {
          setActionMessage({
            type: 'success',
            text: result.message || `Alert #${id} accepted. You are responding. Navigation route is available.`,
          })
          setActiveTab('accepted')
        } else {
          setActionMessage({
            type: 'info',
            text: `Alert #${id} declined for your account. Other eligible responders remain notified.`,
          })
        }
        load()
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network connection failed.' })
    } finally {
      setLoadingAction(null)
    }
  }

  const incomingEmergencies = emergencies.filter((e) => !e.responder_status || e.responder_status === 'incoming')
  const acceptedEmergencies = emergencies.filter((e) => e.responder_status === 'accepted')
  const rejectedEmergencies = emergencies.filter((e) => e.responder_status === 'rejected')

  const displayedEmergencies =
    activeTab === 'incoming'
      ? incomingEmergencies
      : activeTab === 'accepted'
      ? acceptedEmergencies
      : rejectedEmergencies

  return (
    <section>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <p className="eyebrow">Responder workspace</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Nearby Emergency Dispatch</h1>
          {currentResponder ? (
            <p className="mt-2 text-sm text-slate-600">
              Logged in as <strong className="text-slate-900">{currentResponder.name}</strong>
              {' '}({currentResponder.role})
              {currentResponder.verified ? (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <UserCheck className="size-3.5" /> Verified
                </span>
              ) : (
                <span className="ml-2 text-amber-700 font-semibold">Pending verification</span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Select a verified responder to continue.</p>
          )}
          {respondersList.filter((r) => r.verified).length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500" htmlFor="responder-select">Switch responder:</label>
              <select
                id="responder-select"
                className="field-input py-1.5 text-xs max-w-56"
                value={responderId || ''}
                onChange={handleSelectResponder}
              >
                <option value="" disabled>Select a verified responder</option>
                {respondersList
                  .filter((r) => r.verified)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.role}){r.available ? ' ✓ Online' : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
        <button
          className={`availability ${available ? 'online' : ''}`}
          type="button"
          onClick={toggleAvailability}
          disabled={!responderId}
        >
          <span className="status-dot" />
          {available ? 'Online (Receiving Alerts)' : 'Offline'}
        </button>
      </div>

      {locationWarning && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="size-5 shrink-0 text-amber-600" />
          <span>{locationWarning}</span>
        </div>
      )}

      {actionMessage && (
        <div
          className={`mb-5 flex items-center justify-between gap-3 rounded-xl p-4 text-sm ${
            actionMessage.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
              : actionMessage.type === 'error'
              ? 'border border-red-200 bg-red-50 text-red-900'
              : 'border border-slate-200 bg-slate-50 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <Check className="size-5 shrink-0 text-emerald-600" />
            ) : actionMessage.type === 'error' ? (
              <AlertCircle className="size-5 shrink-0 text-red-600" />
            ) : (
              <ShieldAlert className="size-5 shrink-0 text-slate-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            className="text-xs font-semibold underline opacity-70 hover:opacity-100"
            onClick={() => setActionMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="nav-tabs">
          <button
            type="button"
            className={activeTab === 'incoming' ? 'active' : ''}
            onClick={() => setActiveTab('incoming')}
          >
            Incoming Alerts ({incomingEmergencies.length})
          </button>
          <button
            type="button"
            className={activeTab === 'accepted' ? 'active' : ''}
            onClick={() => setActiveTab('accepted')}
          >
            Accepted / Responding ({acceptedEmergencies.length})
          </button>
          <button
            type="button"
            className={activeTab === 'rejected' ? 'active' : ''}
            onClick={() => setActiveTab('rejected')}
          >
            Declined ({rejectedEmergencies.length})
          </button>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => getAndSyncLocation((lat, lng) => load(lat, lng), () => load())}
          title="Refresh alerts"
        >
          <RefreshCw className="size-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          {displayedEmergencies.map((emergency) => {
            const isAccepted = emergency.responder_status === 'accepted'
            const isRejected = emergency.responder_status === 'rejected'
            const isPrimary = emergency.responder_assignment_role === 'primary'
            const isSecondary = emergency.responder_assignment_role === 'secondary'
            const searchStage = emergency.search_stage || ((emergency.search_radius_km || 1) >= 2.0 ? 'Stage 2 (2.0 km expanded)' : 'Stage 1 (1.0 km initial)')
            const etaDisplay = emergency.eta_minutes ? `~${emergency.eta_minutes} mins` : 'Calculating...'

            return (
              <article
                className={`alert-item transition-all ${
                  isAccepted
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-400'
                    : isRejected
                    ? 'opacity-70 bg-slate-50'
                    : ''
                }`}
                key={emergency.id}
              >
                {/* Header with Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge alert">{emergency.emergency_type}</span>
                      <span className={`badge ${isAccepted ? 'verified' : isRejected ? 'rejected' : 'pending'}`}>
                        {isPrimary ? 'Primary Responder' : isSecondary ? 'Backup Responder' : isAccepted ? 'Responding (Accepted)' : isRejected ? 'Declined by you' : 'New Incoming Alert'}
                      </span>
                    </div>
                    <h2 className="mt-2.5 text-lg font-bold text-slate-950">Emergency Alert #{emergency.id}</h2>
                  </div>
                  <Radio className={`size-5 ${isAccepted ? 'text-emerald-600 animate-pulse' : isRejected ? 'text-slate-400' : 'text-[#df4d38] animate-pulse'}`} />
                </div>

                {/* Emergency Location & Meta Details */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-lg border border-slate-200/80 bg-white/70 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <span className="detail-label">Distance</span>
                    <strong className="flex items-center gap-1 text-slate-900">
                      <MapPin className="size-3.5 text-[#df4d38]" />
                      {emergency.distance_km !== null && emergency.distance_km !== undefined
                        ? `${emergency.distance_km} km`
                        : 'Unknown'}
                    </strong>
                  </div>
                  <div>
                    <span className="detail-label">Est. Travel ETA</span>
                    <strong className="flex items-center gap-1 text-slate-900">
                      <Clock3 className="size-3.5 text-blue-600" />
                      {etaDisplay}
                    </strong>
                  </div>
                  <div>
                    <span className="detail-label">Search Stage</span>
                    <strong className="text-amber-800 font-semibold truncate" title={searchStage}>
                      {searchStage}
                    </strong>
                  </div>
                  <div>
                    <span className="detail-label">Location (GPS)</span>
                    <strong className="font-mono text-[11px] text-slate-700">
                      {emergency.latitude.toFixed(4)}, {emergency.longitude.toFixed(4)}
                    </strong>
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-500">ETA is a straight-line distance estimate; live road routing and traffic are not available in this MVP.</p>

                {/* Description */}
                {emergency.description && (
                  <p className="mt-3 text-sm text-slate-700 bg-white/50 rounded-md p-2.5 border border-slate-100">
                    <span className="font-semibold text-slate-900">Note: </span>
                    {emergency.description}
                  </p>
                )}

                {/* Scene Photo if Available */}
                {emergency.scene_photo_filename && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Image className="size-4" />
                      Scene Photo from Caller
                    </div>
                    <img
                      className="responder-scene-photo"
                      src={`/api/emergencies/${emergency.id}/photo?responder_id=${responderId}`}
                      alt={`Scene photo for emergency alert ${emergency.id}`}
                    />
                  </div>
                )}

                {/* Multiple Responders info if accepted */}
                {isAccepted && (
                  <div className="mt-3 rounded-md bg-blue-50 p-2.5 text-xs text-blue-900 border border-blue-200">
                    <strong>{isPrimary ? 'Primary assignment:' : 'Backup assignment:'}</strong>{' '}
                    {isPrimary
                      ? 'You have the lowest current ETA estimate.'
                      : 'You remain accepted as a secondary responder; continue to be ready to assist.'}
                    {emergency.accepted_responders?.length > 1 && ` ${emergency.accepted_responders.length} responders have accepted this emergency.`}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-5 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                  {isAccepted ? (
                    <div className="flex w-full items-center justify-between gap-3">
                      <a
                        className="table-button verify flex-1 justify-center py-2.5 text-xs font-bold shadow-sm"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${emergency.latitude},${emergency.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation className="size-4" />
                        Open Live Navigation (Google Maps)
                      </a>
                    </div>
                  ) : isRejected ? (
                    <div className="flex items-center justify-between w-full text-xs text-slate-500">
                      <span>You declined this emergency alert.</span>
                      <button
                        className="table-button verify text-xs"
                        type="button"
                        onClick={() => decide(emergency.id, 'accept')}
                        disabled={!available || loadingAction === emergency.id}
                      >
                        <Check className="size-3.5" />
                        Re-Accept Alert
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full gap-2.5">
                      <button
                        className="table-button verify flex-1 justify-center py-2.5 text-xs font-bold shadow-sm"
                        type="button"
                        onClick={() => decide(emergency.id, 'accept')}
                        disabled={!available || loadingAction === emergency.id}
                      >
                        <Check className="size-4" />
                        {loadingAction === emergency.id ? 'Accepting...' : 'Accept Emergency'}
                      </button>
                      <button
                        className="table-button reject flex-1 justify-center py-2.5 text-xs font-bold"
                        type="button"
                        onClick={() => decide(emergency.id, 'reject')}
                        disabled={loadingAction === emergency.id}
                      >
                        <X className="size-4" />
                        {loadingAction === emergency.id ? 'Declining...' : 'Decline'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}

          {!displayedEmergencies.length && (
            <div className="surface p-10 text-center">
              <RefreshCw className="mx-auto size-6 text-slate-400" />
              <p className="mt-3 text-sm text-slate-600 font-medium">
                {activeTab === 'incoming'
                  ? available
                    ? 'No new emergency alerts in your radius right now.'
                    : 'You are currently offline. Toggle Online to receive nearby emergency alerts.'
                  : activeTab === 'accepted'
                  ? 'You have not accepted any emergency alerts yet.'
                  : 'No declined emergency alerts.'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {available
                  ? 'The system actively checks within 1 km (and auto-expands to 2 km if needed).'
                  : 'Go online with GPS location enabled to start receiving nearby dispatches.'}
              </p>
            </div>
          )}
        </div>
        <div className="map-shell">
          <EmergencyMap emergencies={displayedEmergencies} />
        </div>
      </div>
    </section>
  )
}
