import { useEffect, useState } from 'react'
import { Ambulance, Ban, Check, MapPin, PhoneCall, Radio, Search } from 'lucide-react'
import EmergencyMap from './EmergencyMap'
import socket, { joinEmergency, leaveEmergency } from '../lib/socket'
import { FIRST_AID_SAFETY_MESSAGE, getFirstAidGuidance } from '../lib/firstAidGuidance'

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
  const [ambulanceSubmitting, setAmbulanceSubmitting] = useState(false)
  const [ambulanceError, setAmbulanceError] = useState('')

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
    joinEmergency(emergency.id)
    function onUpdate(payload) {
      if (payload?.emergencyId === emergency.id) refresh()
    }
    socket.on('emergency:update', onUpdate)
    const timer = window.setInterval(refresh, 3000)
    return () => { active = false; window.clearInterval(timer); socket.off('emergency:update', onUpdate); leaveEmergency(emergency.id) }
  }, [emergency.id])

  async function reportAmbulance(arrived) {
    if (ambulanceSubmitting) return
    setAmbulanceSubmitting(true)
    setAmbulanceError('')
    try {
      const response = await fetch(`/api/emergencies/${emergency.id}/ambulance-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambulance_arrived: arrived }),
      })
      const result = await response.json()
      if (!response.ok || !result.emergency) throw new Error(result.error || 'Could not update ambulance status.')
      setCurrent(result.emergency)
    } catch (requestError) {
      setAmbulanceError(requestError.message)
    } finally {
      setAmbulanceSubmitting(false)
    }
  }

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

  const { steps, donts } = getFirstAidGuidance(current.emergency_type)
  const matchedCount = current.matched_responder_count || 0
  const searchRadius = Number(current.search_radius_km || 1.0)
  const primarySelected = Boolean(current.assigned_responder_id)
  const acceptedCount = current.accepted_count || 0

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
            {primarySelected || acceptedCount > 0 ? (
              <div className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-950 font-bold">
                    {primarySelected ? 'Primary Responder Selected' : 'Responder(s) Accepted'}
                  </strong>
                  <span className="badge verified">{primarySelected ? 'Primary assigned' : 'Help on the way'}</span>
                </div>
                <p className="mt-1 text-emerald-800">
                  {primarySelected && current.responder_name
                    ? `${current.responder_name} (${current.responder_role || 'Verified Responder'}) is the primary responder and is responding.${acceptedCount > 1 ? ` ${acceptedCount - 1} accepted backup responder${acceptedCount > 2 ? 's remain' : ' remains'} available.` : ''}`
                    : `${acceptedCount} verified responder${acceptedCount !== 1 ? 's have' : ' has'} accepted and coordination is in progress.`}
                </p>
                {primarySelected && current.primary_responder_eta_minutes && <p className="mt-2 text-xs text-emerald-800">Primary ETA: ~{current.primary_responder_eta_minutes} min (straight-line distance estimate; no live traffic routing).</p>}
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
            <p className="eyebrow">Ambulance arrival</p>
            <div className="mt-3 flex items-center gap-3">
              <Ambulance className="size-5 text-[#df4d38]" />
              <strong className="text-xl text-slate-950">Has the ambulance arrived?</strong>
            </div>
            <div className="mt-4">
              <div className="flex gap-3">
                <button
                  className="table-button verify flex-1 justify-center py-2.5 text-xs font-bold shadow-sm"
                  type="button"
                  disabled={ambulanceSubmitting || current.ambulance_arrival_status === 'arrived'}
                  onClick={() => reportAmbulance(true)}
                >
                  {ambulanceSubmitting ? 'Updating...' : 'YES'}
                </button>
                <button
                  className="table-button reject flex-1 justify-center py-2.5 text-xs font-bold"
                  type="button"
                  disabled={ambulanceSubmitting || current.ambulance_arrival_status === 'not_yet'}
                  onClick={() => reportAmbulance(false)}
                >
                  {ambulanceSubmitting ? 'Updating...' : 'NO'}
                </button>
              </div>
              {current.ambulance_arrival_status === 'arrived' && (
                <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <div className="flex items-center gap-2 font-bold">
                    <Check className="size-4 text-emerald-600" />
                    Ambulance arrived — confirmation sent to responders.
                  </div>
                  <p className="mt-1 text-xs opacity-80">Thank you for confirming. The responding team has been updated.</p>
                </div>
              )}
              {current.ambulance_arrival_status === 'not_yet' && (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-bold">
                    <Check className="size-4 text-amber-600" />
                    Ambulance not yet arrived — this alert stays active.
                  </div>
                  <p className="mt-1 text-xs opacity-80">The responders can see the ambulance has not arrived yet. Tap YES the moment it arrives.</p>
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">Reporting that the ambulance has not arrived yet keeps this alert active for responders.</p>
              {ambulanceError && <p className="mt-2 text-xs font-semibold text-red-700">{ambulanceError}</p>}
            </div>
          </div>
          <div className="surface">
            <p className="eyebrow">First aid now</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Immediate steps</h2>
            <ol className="guidance-list">
              {steps.map((item) => <li key={item}>{item}</li>)}
            </ol>
            {donts.length > 0 && (
              <div className="guidance-donts">
                <h3>Do NOT</h3>
                <ul>
                  {donts.map((item) => <li key={item}><Ban className="size-4" />{item}</li>)}
                </ul>
              </div>
            )}
            <div className="mt-5 border-t border-slate-200 pt-4">
              <a className="call-button" href="tel:108"><PhoneCall className="size-4" />Call 108 ambulance</a>
              <p className="mt-3 text-xs leading-5 text-slate-500">{FIRST_AID_SAFETY_MESSAGE}</p>
            </div>
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
