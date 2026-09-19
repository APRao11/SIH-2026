import { useEffect, useRef, useState } from 'react'
import { Ambulance, Ban, Check, MapPin, PhoneCall, Radio, Search } from 'lucide-react'
import EmergencyMap from './EmergencyMap'
import socket, { joinEmergency, leaveEmergency } from '../lib/socket'
import { FIRST_AID_SAFETY_MESSAGE, getFirstAidGuidance, hasFixedFirstAidGuidance } from '../lib/firstAidGuidance'
import { formatEmergencySentTime } from '../lib/emergencyTime'

function parseTimestampMs(dateStr) {
  if (!dateStr) return NaN
  if (typeof dateStr === 'number') return dateStr
  if (!dateStr.includes('T') && !dateStr.includes('Z')) {
    return new Date(dateStr.replace(' ', 'T') + 'Z').getTime()
  }
  return new Date(dateStr).getTime()
}

function formatCoordinate(value) {
  const coordinate = Number(value)
  return Number.isFinite(coordinate) ? coordinate.toFixed(6) : 'Unavailable'
}

async function readApiJson(response, fallbackMessage) {
  const body = await response.text()
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(fallbackMessage)
  }
}

const aiFallbackGuidance = {
  steps: [
    'Check the scene: Look for immediate danger to ensure it is safe to approach the person.',
    'Confirm responsiveness: Tap the person firmly on the shoulder to check if they are responsive.',
    'Note visible signs: Identify key signs of the emergency such as severe bleeding, difficulty breathing, or an allergic reaction to relay to emergency responders.',
    'Follow instructions: Follow this guidance precisely while waiting for nearby help to arrive.',
  ],
  donts: [
    'Put yourself in danger: Never place yourself at risk to reach the individual.',
    'Move the person: Do not move the person unless they are in immediate danger from their physical surroundings.',
    'Administer oral substances: Do not give the person food, drink, or oral medication unless explicitly instructed to do so by a medical professional.',
  ],
}

export default function AlertSentScreen({ emergency, onBack }) {
  const [current, setCurrent] = useState(emergency)
  const [secondsRemaining, setSecondsRemaining] = useState(30)
  const [ambulanceSubmitting, setAmbulanceSubmitting] = useState(false)
  const [ambulanceError, setAmbulanceError] = useState('')
  const [handledSubmitting, setHandledSubmitting] = useState(false)
  const [handledError, setHandledError] = useState('')
  const [handledNotice, setHandledNotice] = useState('')

  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const response = await fetch(`/api/emergencies/${emergency.id}`)
        const result = await response.json()
        if (response.ok && active && result.emergency) {
          setCurrent(result.emergency)
          return result.emergency
        }
      } catch { /* Keep the last known emergency state visible. */ }
      return null
    }
    refresh()
    joinEmergency(emergency.id)
    async function onUpdate(payload) {
      if (payload?.emergencyId !== emergency.id) return
      const updatedEmergency = await refresh()
      if (payload.reason === 'resolved' && updatedEmergency?.handled_by_type) {
        setHandledNotice(`${updatedEmergency.handled_by_type}${updatedEmergency.handled_by_name ? ` (${updatedEmergency.handled_by_name})` : ''} said this emergency was handled.`)
      }
    }
    socket.on('emergency:update', onUpdate)
    const timer = window.setInterval(refresh, 3000)
    return () => { active = false; window.clearInterval(timer); socket.off('emergency:update', onUpdate); leaveEmergency(emergency.id) }
  }, [emergency.id, emergency.description, emergency.emergency_type])

  async function reportAmbulance() {
    if (ambulanceSubmitting) return
    setAmbulanceSubmitting(true)
    setAmbulanceError('')
    try {
      const response = await fetch(`/api/emergencies/${emergency.id}/ambulance-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambulance_arrived: true }),
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

  async function markHandled() {
    if (handledSubmitting || current.status === 'resolved') return
    setHandledSubmitting(true)
    setHandledError('')
    try {
      const response = await fetch(`/api/emergencies/${emergency.id}/handled`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responder_id: 0, actor: 'bystander' }),
      })
      const result = await response.json()
      if (!response.ok || !result.emergency) throw new Error(result.error || 'Could not mark the situation handled.')
      setCurrent(result.emergency)
      setHandledNotice('Bystander said this emergency was handled.')
    } catch (requestError) {
      setHandledError(requestError.message)
    } finally {
      setHandledSubmitting(false)
    }
  }

  useEffect(() => {
    if ((current.search_radius_km || 1.0) >= 2.0 || current.assigned_responder_id) return
    const updateCountdown = () => {
      const createdMs = parseTimestampMs(current.created_at)
      if (!Number.isNaN(createdMs)) {
        const elapsedSec = Math.floor((Date.now() - createdMs) / 1000)
        const rem = Math.max(0, 30 - elapsedSec)
        setSecondsRemaining(rem)
      }
    }
    updateCountdown()
    const interval = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(interval)
  }, [current.created_at, current.search_radius_km, current.assigned_responder_id])

  const [aiGuidance, setAiGuidance] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const guidanceRequests = useRef(new Map())

  useEffect(() => {
    if (current.emergency_type !== 'Other' || !current.description?.trim()) {
      setAiGuidance(null)
      setAiError('')
      setAiLoading(false)
      return undefined
    }

    let active = true
    const requestKey = `${current.id}:${current.description}`
    let request = guidanceRequests.current.get(requestKey)
    if (!request) {
      request = (async () => {
        const response = await fetch('/api/ai/emergency-guidance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: current.description }),
        })
        const result = await readApiJson(response, 'AI guidance returned an invalid response. Please follow instructions from 108.')
        if (!response.ok) throw new Error(result.error || 'AI guidance is temporarily unavailable.')
        if (!result.guidance || !Array.isArray(result.guidance.steps)) throw new Error('AI guidance returned an invalid response. Please follow instructions from 108.')
        return result.guidance
      })()
      guidanceRequests.current.set(requestKey, request)
    }

    setAiLoading(true)
    setAiError('')
    request
      .then((guidance) => { if (active) setAiGuidance(guidance) })
      .catch((requestError) => { if (active) setAiError(requestError.message) })
      .finally(() => { if (active) setAiLoading(false) })
    return () => { active = false }
  }, [current.id, current.description, current.emergency_type])

  const fixedGuidance = getFirstAidGuidance(current.emergency_type)
  const usesFixedGuidance = hasFixedFirstAidGuidance(current.emergency_type)
  const steps = fixedGuidance.steps
  const donts = usesFixedGuidance ? fixedGuidance.donts : []
  const matchedCount = current.matched_responder_count || 0
  const searchRadius = Number(current.search_radius_km || 1.0)
  const primarySelected = Boolean(current.assigned_responder_id)
  const acceptedCount = current.accepted_count || 0
  const emergencyLocation = Number.isFinite(Number(current.latitude)) && Number.isFinite(Number(current.longitude))
    ? { latitude: Number(current.latitude), longitude: Number(current.longitude) }
    : null
  const responderLocation = Number.isFinite(Number(current.responder_latitude)) && Number.isFinite(Number(current.responder_longitude))
    ? { latitude: Number(current.responder_latitude), longitude: Number(current.responder_longitude), name: current.responder_name }
    : null
  const handledLabel = current.handled_by_type
    ? `${current.handled_by_type}${current.handled_by_name ? ` (${current.handled_by_name})` : ''}`
    : 'Someone'

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
      {handledNotice && <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950 shadow-sm" role="status">{handledNotice}</div>}
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
                <strong>{formatCoordinate(current.latitude)}, {formatCoordinate(current.longitude)}</strong>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="detail-label">Emergency Sent</span>
              <strong className="mt-1 block text-slate-950">{formatEmergencySentTime(current.created_at)}</strong>
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
            <p className="eyebrow">Emergency status</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Has the situation been handled?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Notify every responder that assistance is no longer required.</p>
            <button className="secondary-button mt-4" type="button" disabled={handledSubmitting || current.status === 'resolved'} onClick={markHandled}>
              <Check className="size-4" />
              {current.status === 'resolved' ? 'Situation Handled' : handledSubmitting ? 'Updating...' : 'Situation Handled'}
            </button>
            {current.status === 'resolved' && <p className="mt-3 text-sm font-semibold text-emerald-700">Responders have been notified that this situation is handled.</p>}
            {current.status === 'resolved' && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">{handledLabel} said this emergency was handled.</p>}
            {handledError && <p className="mt-3 text-sm font-semibold text-red-700">{handledError}</p>}
          </div>
          <div className="surface">
            <p className="eyebrow">Ambulance arrival</p>
            <div className="mt-3 flex items-center gap-3">
              <Ambulance className="size-5 text-[#df4d38]" />
              <strong className="text-xl text-slate-950">Has the ambulance arrived?</strong>
            </div>
            <div className="mt-4">
              <button className="table-button verify w-full justify-center py-2.5 text-xs font-bold shadow-sm" type="button" disabled={ambulanceSubmitting || current.ambulance_arrival_status === 'arrived'} onClick={reportAmbulance}>
                <Ambulance className="size-4" />
                {ambulanceSubmitting ? 'Updating...' : 'Ambulance Arrived'}
              </button>
              {current.ambulance_arrival_status === 'arrived' && (
                <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <div className="flex items-center gap-2 font-bold">
                    <Check className="size-4 text-emerald-600" />
                    Ambulance arrived — confirmation sent to responders.
                  </div>
                  <p className="mt-1 text-xs opacity-80">Thank you for confirming. The responding team has been updated.</p>
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">Only confirm this after the ambulance has physically arrived.</p>
              {ambulanceError && <p className="mt-2 text-xs font-semibold text-red-700">{ambulanceError}</p>}
            </div>
          </div>
          <div className="surface">
            <p className="eyebrow">First-aid guidance</p>
            {current.emergency_type === 'Other' ? (
              <>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">AI guidance</h2>
                {aiLoading && <p className="mt-3 text-sm font-semibold text-slate-700">Getting guidance…</p>}
                {aiError && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">⚠️ AI Response Failed or API Exhausted for MVP</p>
                    <h3 className="mt-2 text-lg font-bold text-slate-950">General First-Aid Guidance</h3>
                    <div className="mt-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Immediate Steps</p>
                      <ol className="guidance-list mt-2">
                        {aiFallbackGuidance.steps.map((item) => <li key={item}>{item}</li>)}
                      </ol>
                    </div>
                    <div className="guidance-donts mt-4">
                      <h3>Do NOT</h3>
                      <ul>
                        {aiFallbackGuidance.donts.map((item) => <li key={item}><Ban className="size-4" />{item}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
                {aiGuidance ? (
                  <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-left">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-purple-700">AI safety guidance</p>
                    <h3 className="mt-2 text-lg font-bold text-slate-950">{aiGuidance.title}</h3>
                    <ol className="guidance-list mt-3">
                      {aiGuidance.steps.map((item) => <li key={item}>{item}</li>)}
                    </ol>
                  </div>
                ) : !aiLoading && !aiError && (
                  <p className="mt-3 text-sm text-slate-500">Waiting for immediate guidance based on the description you shared.</p>
                )}
                {aiGuidance?.disclaimer && <p className="mt-3 text-xs leading-5 text-slate-500">{aiGuidance.disclaimer}</p>}
              </>
            ) : (
              <>
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
              </>
            )}
            <div className="mt-5 border-t border-slate-200 pt-4">
              <a className="call-button" href="tel:108"><PhoneCall className="size-4" />Call 108 ambulance</a>
              <p className="mt-3 text-xs leading-5 text-slate-500">{FIRST_AID_SAFETY_MESSAGE}</p>
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="map-shell">
            <EmergencyMap location={emergencyLocation} responder={responderLocation} emergencies={[]} />
          </div>
          <div className="surface flex items-start gap-3 text-sm text-slate-600">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[#df4d38]" />
            <p>{responderLocation ? `Live responder location: ${formatCoordinate(responderLocation.latitude)}, ${formatCoordinate(responderLocation.longitude)}. ETA ~${current.primary_responder_eta_minutes || 'calculating'} min.` : 'Emergency location is live. A responder location will appear when available.'}</p>
          </div>
          <button className="secondary-button" type="button" onClick={onBack}>Return home</button>
        </div>
      </div>
    </section>
  )
}
