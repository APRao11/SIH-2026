import { useEffect, useState } from 'react'
import { Check, Clock3, MapPin, Radio } from 'lucide-react'
import EmergencyMap from './EmergencyMap'

const guidance = {
  Accident: ['Move to a safe place if possible.', 'Do not move the injured person unless there is immediate danger.', 'Keep the person still and check for breathing.'],
  'Cardiac emergency': ['Call 108 and follow the dispatcher instructions.', 'If the person is unresponsive and not breathing normally, begin CPR if trained.', 'Ask someone to find an AED if one is nearby.'],
  Burns: ['Move away from the heat source.', 'Cool the burn with clean, running water for 20 minutes.', 'Do not apply ice, creams, or remove stuck clothing.'],
  'Unconscious Person': ['Check that the person is breathing normally.', 'If they are breathing, place them on their side and monitor them.', 'If they are not breathing normally, begin CPR if trained.'],
  Other: ['Check that the area is safe before approaching.', 'Keep the person comfortable and monitor their breathing.', 'Do not give food, drink, or medication unless directed by professionals.'],
}

export default function AlertSentScreen({ emergency: initialEmergency, onBack }) {
  const [emergency, setEmergency] = useState(initialEmergency)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const response = await fetch(`/api/emergencies/${initialEmergency.id}`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.error)
        if (active) setEmergency(result.emergency)
      } catch (error) { if (active) setLoadError(error.message) }
    }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [initialEmergency.id])

  const steps = guidance[emergency.emergency_type] || guidance.Other
  const assigned = Boolean(emergency.assigned_responder_id)
  return <section className="mx-auto max-w-5xl"><div className="sent-header"><div className="confirmation-icon"><Check className="size-6" /></div><div><p className="eyebrow">Alert #{emergency.id} sent</p><h1 className="mt-2 text-4xl font-bold text-slate-950">Nearby responders have been notified</h1><p className="mt-3 text-base text-slate-600">Stay with the person while the response is coordinated.</p></div></div><div className="sent-grid mt-8"><div className="space-y-5"><div className="surface"><p className="eyebrow">Current response</p><div className="mt-3 flex items-center gap-3"><Radio className="size-5 text-emerald-600" /><strong className="text-xl text-slate-950">{emergency.status}</strong></div><div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2"><div><span className="detail-label">Emergency type</span><strong>{emergency.emergency_type}</strong></div><div><span className="detail-label">Live location</span><strong>{emergency.latitude.toFixed(6)}, {emergency.longitude.toFixed(6)}</strong></div></div>{assigned ? <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm"><strong className="text-emerald-900">Assigned responder</strong><p className="mt-1 text-emerald-800">{emergency.responder_name || 'Verified responder'}{emergency.responder_role ? `, ${emergency.responder_role}` : ''}</p><p className="mt-2 flex items-center gap-2 text-emerald-700"><Clock3 className="size-4" />Responder ETA is not available yet.</p></div> : <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Searching for a nearby verified responder...</div>}{loadError && <p className="mt-4 text-sm text-red-700">{loadError}</p>}</div><div className="surface"><p className="eyebrow">First aid now</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Immediate steps</h2><ol className="guidance-list">{steps.map((item) => <li key={item}>{item}</li>)}</ol><p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">First-aid guidance is for immediate assistance only and does not replace professional medical care.</p></div></div><div className="space-y-5"><div className="map-shell"><EmergencyMap location={{ latitude: emergency.latitude, longitude: emergency.longitude }} emergencies={[]} /></div><div className="surface flex items-start gap-3 text-sm text-slate-600"><MapPin className="mt-0.5 size-4 shrink-0 text-[#df4d38]" /><p>Emergency location is live. A responder location will appear here when the platform receives it.</p></div><button className="secondary-button" type="button" onClick={onBack}>Return home</button></div></div></section>
}