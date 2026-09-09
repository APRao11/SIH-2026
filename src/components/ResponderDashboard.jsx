import { useEffect, useState } from 'react'
import { AlertCircle, Check, Image, LogIn, MapPin, Radio, RefreshCw, X } from 'lucide-react'
import EmergencyMap from './EmergencyMap'

export default function ResponderDashboard({ responder }) {
  const [available, setAvailable] = useState(Boolean(responder?.available))
  const [emergencies, setEmergencies] = useState([])
  const [acceptedEmergency, setAcceptedEmergency] = useState(null)
  const [message, setMessage] = useState('')
  const [locationWarning, setLocationWarning] = useState('')
  const responderId = responder?.id || Number(localStorage.getItem('responderId'))

  async function updateServerLocation(latitude, longitude) {
    if (!responderId) return false
    try {
      const response = await fetch(`/api/responders/${responderId}/location`, {
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

  async function load(latitude, longitude) {
    if (!responderId) return
    const locationQuery =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? `&latitude=${latitude}&longitude=${longitude}`
        : ''
    try {
      const response = await fetch(`/api/responder/emergencies?responder_id=${responderId}${locationQuery}`)
      const result = await response.json()
      if (response.ok) {
        setEmergencies(result.emergencies || [])
        if (result.message && (!result.emergencies || result.emergencies.length === 0)) {
          setLocationWarning(result.message)
        } else {
          setLocationWarning('')
        }
      } else {
        setMessage(result.error || 'Failed to fetch emergencies.')
      }
    } catch {
      setMessage('Failed to connect to emergency service.')
    }
  }

  function getAndSyncLocation(onSuccess, onError) {
    if (!navigator.geolocation) {
      setLocationWarning('Geolocation is not supported by your browser. Location is required for 1 km emergency matching.')
      if (onError) onError()
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        await updateServerLocation(coords.latitude, coords.longitude)
        if (onSuccess) onSuccess(coords.latitude, coords.longitude)
      },
      (error) => {
        setLocationWarning('Location access is required for nearby emergency matching (within 1 km). Please enable location in your browser.')
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
    }, 30000)
    return () => window.clearInterval(interval)
  }, [responderId, available])

  async function toggleAvailability() {
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
            setMessage(result.error)
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
          if (!response.ok) setMessage(result.error)
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
      if (!response.ok) setMessage(result.error)
      else {
        setAvailable(false)
        setEmergencies([])
      }
    }
  }

  async function decide(id, action) {
    const endpoint = action === 'accept' ? 'accept' : 'reject'
    const body = action === 'accept' ? { responder_id: responderId } : {}
    const response = await fetch(`/api/emergencies/${id}/${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok) {
      setMessage(result.error)
    } else {
      setMessage(action === 'accept' ? `Alert #${id} accepted. Navigation is ready.` : `Alert #${id} rejected.`)
      if (action === 'accept') setAcceptedEmergency(result.emergency)
      load()
    }
  }

  return (
    <section>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Responder workspace</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Alerts nearby</h1>
          <p className="mt-2 text-sm text-slate-600">
            {responder?.name ? `Welcome, ${responder.name}.` : 'Select a verified responder to continue.'}
          </p>
        </div>
        <button
          className={`availability ${available ? 'online' : ''}`}
          type="button"
          onClick={toggleAvailability}
          disabled={!responderId}
        >
          <span className="status-dot" />
          {available ? 'Online' : 'Offline'}
        </button>
      </div>

      {locationWarning && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="size-5 shrink-0 text-amber-600" />
          <span>{locationWarning}</span>
        </div>
      )}

      {message && (
        <p className="mb-5 flex items-center gap-2 text-sm font-medium text-emerald-700">
          <Check className="size-4" />
          {message}
        </p>
      )}

      {acceptedEmergency && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <span>Navigation to alert #{acceptedEmergency.id} is ready.</span>
          <a
            className="table-button verify"
            href={`https://www.google.com/maps/dir/?api=1&destination=${acceptedEmergency.latitude},${acceptedEmergency.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            <LogIn className="size-4" />
            Navigate
          </a>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          {emergencies.map((emergency) => (
            <article className="alert-item" key={emergency.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="badge alert">{emergency.emergency_type}</span>
                  <h2 className="mt-3 text-lg font-bold text-slate-950">Emergency alert #{emergency.id}</h2>
                </div>
                <Radio className="size-5 text-[#df4d38]" />
              </div>
              {emergency.scene_photo_filename && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <Image className="size-4" />
                    Scene photo
                  </div>
                  <img
                    className="responder-scene-photo"
                    src={`/api/emergencies/${emergency.id}/photo?responder_id=${responderId}`}
                    alt={`Scene photo for emergency alert ${emergency.id}`}
                  />
                </div>
              )}
              <p className="mt-2 text-sm text-slate-600">{emergency.description || 'No additional description.'}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="size-4" />
                {emergency.distance_km === null
                  ? 'Distance unavailable'
                  : `${emergency.distance_km} km away (within 1 km response radius)`}
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  className="table-button verify"
                  type="button"
                  onClick={() => decide(emergency.id, 'accept')}
                  disabled={!available}
                >
                  <Check className="size-4" />
                  Accept
                </button>
                <button
                  className="table-button reject"
                  type="button"
                  onClick={() => decide(emergency.id, 'reject')}
                >
                  <X className="size-4" />
                  Reject
                </button>
              </div>
            </article>
          ))}
          {!emergencies.length && (
            <div className="surface p-10 text-center">
              <RefreshCw className="mx-auto size-6 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">
                {available
                  ? 'No active emergencies within 1 km right now.'
                  : 'You are currently offline. Go online to receive nearby emergency alerts.'}
              </p>
            </div>
          )}
        </div>
        <div className="map-shell">
          <EmergencyMap emergencies={emergencies} />
        </div>
      </div>
    </section>
  )
}
