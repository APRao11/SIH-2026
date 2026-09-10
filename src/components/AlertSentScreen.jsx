import { useEffect, useState } from 'react'
import { Check, MapPin, Radio, Search } from 'lucide-react'
import EmergencyMap from './EmergencyMap'

const guidance = {
  Accident: ['Move to a safe place if possible.', 'Keep the person still and check for breathing.', 'Continue professional emergency assistance immediately.'],
  'Cardiac emergency': ['Call 108 and follow dispatcher instructions.', 'Begin CPR if trained and the person is not breathing normally.', 'Ask someone to find an AED if nearby.'],
  Burns: ['Move away from the heat source.', 'Cool the burn with clean running water for 20 minutes.', 'Do not apply ice, creams, or butter.'],
  Other: ['Check that the area is safe.', 'Keep the person comfortable and monitor breathing.', 'Continue professional emergency assistance immediately.'],
}

function parseTimestampMs(dateStr) {
  if (!dateStr) return NaN
  if (typeof dateStr === 'number') return dateStr
  if (!dateStr.includes('T') && !dateStr.includes('Z')) {
    return new Date(dateStr.replace(' ', 'T') + 'Z').getTime()
  }
  return new Date(dateStr).getTime()
}

export default function AlertSentScreen({ emergency, onBack }) {
  const [current, setCurrent] = useState(emergency)
  const [secondsRemaining, setSecondsRemaining] = useState(20)

  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const response = await fetch(`/api/emergencies/${emergency.id}`)
        const result = await response.json()
        if (response.ok && active && result.emergency) {
          setCurrent(result.emergency)
        }
      } catch { /* Keep the last known emergency state visible. */ }
    }
    refresh()
    const timer = window.setInterval(refresh, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [emergency.id])

  useEffect(() => {
    if ((current.search_radius_km || 1.0) >= 2.0 || current.assigned_responder_id) return
    const updateCountdown = () => {
      const createdMs = parseTimestampMs(current.created_at)
      if (!Number.isNaN(createdMs)) {
        const elapsedSec = Math.floor((Date.now() - createdMs) / 1000)
        const rem = Math.max(0, 20 - elapsedSec)
        setSecondsRemaining(rem)
      }
    }
    updateCountdown()
    const interval = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(interval)
  }, [current.created_at, current.search_radius_km, current.assigned_responder_id])

  const steps = guidance[current.emergency_type] || guidance.Other
  const matchedCount = current.matched_responder_count || 0
  const searchRadius = Number(current.search_radius_km || 1.0)

  return (
    <section className="mx-auto max-w-5xl">
      <div className="sent-header">
        <div className="confirmation-icon"><Check className="size-6" /></div>
        <div>
          <p className="eyebrow">Alert #{current.id} sent</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">Nearby responders have been notified</h1>
          <p className="mt-3 text-base text-slate-600">Stay with the person while the response is coordinated.</p>
        </div>
      </div>
      <div className="sent-grid mt-8">
        <div className="space-y-5">
          <div className="surface">
            <p className="eyebrow">Current response</p>
            <div className="mt-3 flex items-center gap-3">
              <Radio className="size-5 text-emerald-600" />
              <strong className="text-xl text-slate-950">{current.status}</strong>
            </div>
            <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 text-sm sm:grid-cols-3">
              <div>
                <span className="detail-label">Emergency type</span>
                <strong>{current.emergency_type}</strong>
              </div>
              <div>
                <span className="detail-label">Search radius</span>
                <strong className={searchRadius >= 2.0 ? 'text-amber-800' : 'text-slate-950'}>{searchRadius} km</strong>
              </div>
              <div>
                <span className="detail-label">Live location</span>
                <strong>{current.latitude.toFixed(6)}, {current.longitude.toFixed(6)}</strong>
              </div>
            </div>
            {current.assigned_responder_id || (current.accepted_count && current.accepted_count > 0) ? (
              <div className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-950 font-bold">
                    {current.accepted_count > 1
                      ? `${current.accepted_count} Community Responders Accepted`
                      : 'Verified Responder Accepted'}
                  </strong>
                  <span className="badge verified">Help on the way</span>
                </div>
                <p className="mt-1 text-emerald-800">
                  {current.accepted_count > 1
                    ? `${current.accepted_count} nearby medical/trained volunteers have accepted this alert and are heading to your location.`
                    : current.responder_name
                    ? `${current.responder_name} (${current.responder_role || 'Verified Responder'}) is responding.`
                    : 'A verified community responder has accepted your emergency alert and is en route.'}
                </p>
                <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <Check className="size-4 text-emerald-600" />
                  Radius expansion locked • Responder live coordination active
                </p>
              </div>
            ) : (
              <div className={`mt-5 rounded-lg p-4 text-sm ${searchRadius >= 2.0 ? 'border border-amber-300 bg-amber-50 text-amber-950' : 'bg-amber-50 text-amber-900'}`}>
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <div className="flex items-center gap-2">
                    <Search className="size-4 text-amber-700" />
                    <span>
                      {searchRadius >= 2.0 ? 'Expanded Search (2 km)' : 'Initial Search (1 km)'}
                    </span>
                  </div>
                  {searchRadius < 2.0 && (
                    <span className="text-xs font-normal text-amber-700">
                      Auto-expanding in {secondsRemaining}s
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
                  {searchRadius >= 2.0
                    ? matchedCount > 0
                      ? `Search expanded to 2 km. Alert sent to ${matchedCount} nearby verified responder${matchedCount > 1 ? 's' : ''}.`
                      : 'Expanding search to 2 km... Searching for nearby verified responders within 2 km.'
                    : matchedCount > 0
                      ? `Alert sent to ${matchedCount} nearby verified responder${matchedCount > 1 ? 's' : ''} within 1 km.`
                      : 'Searching within 1 km for nearby verified responders...'}
                </p>
              </div>
            )}
          </div>
          <div className="surface">
            <p className="eyebrow">First aid now</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Immediate steps</h2>
            <ol className="guidance-list">
              {steps.map((item) => <li key={item}>{item}</li>)}
            </ol>
            <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">First-aid guidance is for immediate assistance only and does not replace professional medical care.</p>
          </div>
        </div>
        <div className="space-y-5">
          <div className="map-shell">
            <EmergencyMap location={{ latitude: current.latitude, longitude: current.longitude }} emergencies={[]} />
          </div>
          <div className="surface flex items-start gap-3 text-sm text-slate-600">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[#df4d38]" />
            <p>Emergency location is live. A responder location will appear when available.</p>
          </div>
          <button className="secondary-button" type="button" onClick={onBack}>Return home</button>
        </div>
      </div>
    </section>
  )
}
