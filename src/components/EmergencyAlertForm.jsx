import { useState } from 'react'
import { Check, ChevronDown, Crosshair, MapPin, Send, ShieldCheck } from 'lucide-react'

const emergencyTypes = ['Accident', 'Cardiac emergency', 'Breathing problem', 'Injury', 'Bleeding', 'Burns', 'Other']
const statusSteps = ['Alert created', 'Searching for nearby responders', 'Responder found', 'Help on the way']

function formatCoordinate(value) {
  return value === null ? 'Not shared yet' : value.toFixed(6)
}

export default function EmergencyAlertForm() {
  const [emergencyType, setEmergencyType] = useState('Accident')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState(null)
  const [locationState, setLocationState] = useState('idle')
  const [alertCreated, setAlertCreated] = useState(false)
  const [statusIndex, setStatusIndex] = useState(-1)

  function shareLocation() {
    if (!navigator.geolocation) { setLocationState('unsupported'); return }
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocation({ latitude: coords.latitude, longitude: coords.longitude }); setLocationState('success') },
      () => setLocationState('error'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function createAlert(event) {
    event.preventDefault()
    setAlertCreated(true)
    setStatusIndex(0)
    window.setTimeout(() => setStatusIndex(1), 800)
    window.setTimeout(() => setStatusIndex(2), 1800)
    window.setTimeout(() => setStatusIndex(3), 3000)
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)] lg:items-start">
      <form className="space-y-8" onSubmit={createAlert}>
        <div className="space-y-3"><label className="field-label" htmlFor="emergency-type">What happened?</label><div className="relative"><select id="emergency-type" className="field-input appearance-none pr-12" value={emergencyType} onChange={(event) => setEmergencyType(event.target.value)}>{emergencyTypes.map((type) => <option key={type}>{type}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-500" aria-hidden="true" /></div></div>
        <div className="space-y-3"><label className="field-label" htmlFor="description">Short description <span>(optional)</span></label><textarea id="description" className="field-input min-h-32 resize-y" maxLength="240" placeholder="Add anything that could help a responder prepare..." value={description} onChange={(event) => setDescription(event.target.value)} /><p className="text-right text-xs text-slate-500">{description.length}/240</p></div>
        <div className="location-panel"><div className="flex items-start gap-3"><div className="icon-box"><MapPin className="size-5" aria-hidden="true" /></div><div><h2 className="text-sm font-semibold text-slate-950">Your location</h2><p className="mt-1 text-sm leading-6 text-slate-600">Sharing your location helps nearby responders find you faster.</p></div></div><button className="secondary-button mt-5" type="button" onClick={shareLocation} disabled={locationState === 'loading'}><Crosshair className="size-4" aria-hidden="true" />{locationState === 'loading' ? 'Finding your location...' : location ? 'Location shared' : 'Share my location'}</button>{location && <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm"><div><dt className="text-xs text-slate-500">Latitude</dt><dd className="mt-1 font-mono text-slate-900">{formatCoordinate(location.latitude)}</dd></div><div><dt className="text-xs text-slate-500">Longitude</dt><dd className="mt-1 font-mono text-slate-900">{formatCoordinate(location.longitude)}</dd></div></dl>}{(locationState === 'error' || locationState === 'unsupported') && <p className="mt-3 text-sm font-medium text-red-700">{locationState === 'unsupported' ? 'Location is not supported by this browser.' : 'Location access was not granted. You can still create an alert.'}</p>}</div>
        <button className="alert-button" type="submit"><Send className="size-5" aria-hidden="true" />Send emergency alert</button><p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />Your alert is shared with verified nearby responders.</p>
      </form>
      <aside className="status-card" aria-live="polite"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Response status</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{alertCreated ? statusSteps[statusIndex] : 'Ready when you are'}</h2></div><span className={`status-dot ${alertCreated ? 'is-active' : ''}`} /></div><div className="mt-10 space-y-0">{statusSteps.map((step, index) => { const isComplete = index < statusIndex; const isCurrent = index === statusIndex; return <div className="status-step" key={step}><div className={`status-marker ${isComplete || isCurrent ? 'is-active' : ''}`}>{isComplete ? <Check className="size-3" strokeWidth={3} /> : index + 1}</div><div className={`${isCurrent ? 'text-slate-950' : 'text-slate-500'} text-sm font-medium`}>{step}</div></div> })}</div>{!alertCreated && <p className="mt-10 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">Once you send an alert, we’ll show each step as help is coordinated.</p>}</aside>
    </div>
  )
}