import { useEffect, useState } from 'react'
import { Check, Clock3, MapPin, Radio } from 'lucide-react'
import EmergencyMap from './EmergencyMap'

const guidance = {
  Accident: ['Move to a safe place if possible.', 'Keep the person still and check for breathing.', 'Continue professional emergency assistance immediately.'],
  'Cardiac emergency': ['Call 108 and follow dispatcher instructions.', 'Begin CPR if trained and the person is not breathing normally.', 'Ask someone to find an AED if nearby.'],
  Burns: ['Move away from the heat source.', 'Cool the burn with clean running water for 20 minutes.', 'Do not apply ice, creams, or butter.'],
  Other: ['Check that the area is safe.', 'Keep the person comfortable and monitor breathing.', 'Continue professional emergency assistance immediately.'],
}

export default function AlertSentScreen({ emergency, onBack }) {
  const [current, setCurrent] = useState(emergency)
  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const response = await fetch(`/api/emergencies/${emergency.id}`)
        const result = await response.json()
        if (response.ok && active) setCurrent(result.emergency)
      } catch { /* Keep the last known emergency state visible. */ }
    }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [emergency.id])

  const steps = guidance[current.emergency_type] || guidance.Other
  return <section className="mx-auto max-w-5xl"><div className="sent-header"><div className="confirmation-icon"><Check className="size-6" /></div><div><p className="eyebrow">Alert #{current.id} sent</p><h1 className="mt-2 text-4xl font-bold text-slate-950">Nearby responders have been notified</h1><p className="mt-3 text-base text-slate-600">Stay with the person while the response is coordinated.</p></div></div><div className="sent-grid mt-8"><div className="space-y-5"><div className="surface"><p className="eyebrow">Current response</p><div className="mt-3 flex items-center gap-3"><Radio className="size-5 text-emerald-600" /><strong className="text-xl text-slate-950">{current.status}</strong></div><div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2"><div><span className="detail-label">Emergency type</span><strong>{current.emergency_type}</strong></div><div><span className="detail-label">Live location</span><strong>{current.latitude.toFixed(6)}, {current.longitude.toFixed(6)}</strong></div></div>{current.assigned_responder_id ? <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm"><strong className="text-emerald-900">Assigned responder</strong><p className="mt-1 text-emerald-800">Verified responder assigned</p><p className="mt-2 flex items-center gap-2 text-emerald-700"><Clock3 className="size-4" />Responder ETA is not available yet.</p></div> : <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Searching for a nearby verified responder...</div>}</div><div className="surface"><p className="eyebrow">First aid now</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Immediate steps</h2><ol className="guidance-list">{steps.map((item) => <li key={item}>{item}</li>)}</ol><p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">First-aid guidance is for immediate assistance only and does not replace professional medical care.</p></div></div><div className="space-y-5"><div className="map-shell"><EmergencyMap location={{ latitude: current.latitude, longitude: current.longitude }} emergencies={[]} /></div><div className="surface flex items-start gap-3 text-sm text-slate-600"><MapPin className="mt-0.5 size-4 shrink-0 text-[#df4d38]" /><p>Emergency location is live. A responder location will appear when available.</p></div><button className="secondary-button" type="button" onClick={onBack}>Return home</button></div></div></section>
}
