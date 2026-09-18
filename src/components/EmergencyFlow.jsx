import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Flame, HeartPulse, MapPin, PhoneCall, TriangleAlert, UserRound, Waves } from 'lucide-react'
import EmergencyMap from './EmergencyMap'
import AlertSentScreen from './AlertSentScreen'

const emergencyTypes = [
  { label: 'Road Accident', value: 'Accident', icon: TriangleAlert },
  { label: 'Cardiac Emergency', value: 'Cardiac emergency', icon: HeartPulse },
  { label: 'Fire / Burn', value: 'Burns', icon: Flame },
  { label: 'Unconscious Person', value: 'Unconscious Person', icon: UserRound },
  { label: 'Other', value: 'Other', icon: Waves },
]
const ACTIVE_EMERGENCY_STORAGE_KEY = 'activeEmergencyId'

function requestCurrentLocation(onSuccess, onFailure) {
  const accurateOptions = { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
  const fallbackOptions = { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
  navigator.geolocation.getCurrentPosition(onSuccess, (firstError) => {
    if (firstError.code === 2 || firstError.code === 3) {
      navigator.geolocation.getCurrentPosition(onSuccess, onFailure, fallbackOptions)
      return
    }
    onFailure(firstError)
  }, accurateOptions)
}

async function readApiJson(response, fallbackMessage) {
  const body = await response.text()
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(fallbackMessage)
  }
}

export default function EmergencyFlow({ onBack }) {
  const [step, setStep] = useState(() => (sessionStorage.getItem(ACTIVE_EMERGENCY_STORAGE_KEY) ? 'restoring' : 'calling'))
  const [selectedType, setSelectedType] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const [otherDescription, setOtherDescription] = useState('')
  const [sentEmergency, setSentEmergency] = useState(null)

  useEffect(() => {
    if (step !== 'restoring') return
    let active = true
    ;(async () => {
      const activeId = Number(sessionStorage.getItem(ACTIVE_EMERGENCY_STORAGE_KEY))
      if (!Number.isFinite(activeId) || activeId < 1) {
        sessionStorage.removeItem(ACTIVE_EMERGENCY_STORAGE_KEY)
        if (active) setStep('calling')
        return
      }
      try {
        const response = await fetch(`/api/emergencies/${activeId}`)
        const result = await response.json()
        if (!active) return
        if (response.ok && result.emergency?.scene_photo_path) {
          setSentEmergency(result.emergency)
          setStep('sent')
        } else {
          sessionStorage.removeItem(ACTIVE_EMERGENCY_STORAGE_KEY)
          setStep('calling')
        }
      } catch {
        if (active) {
          sessionStorage.removeItem(ACTIVE_EMERGENCY_STORAGE_KEY)
          setStep('calling')
        }
      }
    })()
    return () => { active = false }
  }, [step])

  function handleSent(emergency) {
    sessionStorage.setItem(ACTIVE_EMERGENCY_STORAGE_KEY, String(emergency.id))
    setSentEmergency(emergency)
    setStep('sent')
  }

  function handleReturnHome() {
    sessionStorage.removeItem(ACTIVE_EMERGENCY_STORAGE_KEY)
    onBack()
  }

  if (step === 'restoring') return <section className="mx-auto max-w-2xl text-center"><div className="call-panel mt-8"><div className="call-icon"><TriangleAlert className="size-7" /></div><p className="eyebrow mt-8">Active emergency</p><h1 className="mt-3 text-4xl font-bold text-slate-950">Restoring your alert…</h1><p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">You have an active emergency. Loading its current status.</p></div></section>
  if (step === 'sent') return <AlertSentScreen emergency={sentEmergency} onBack={handleReturnHome} />
  if (step === 'confirmation') return <AlertConfirmation emergencyType={selectedType} capturedImage={capturedImage} initialDescription={otherDescription} onBack={() => setStep(selectedType === 'Other' ? 'other-guidance' : 'photo')} onSent={handleSent} />
  if (step === 'photo') return <CameraVerification capturedImage={capturedImage} onCapture={setCapturedImage} onBack={() => setStep('types')} onContinue={() => setStep('confirmation')} />
  if (step === 'other-guidance') return <OtherEmergencyAssistant capturedImage={capturedImage} onCapture={setCapturedImage} description={otherDescription} onDescription={setOtherDescription} onBack={() => setStep('types')} onContinue={() => setStep('confirmation')} />
  if (step === 'types') return <TypeSelection selectedType={selectedType} onSelect={setSelectedType} onChooseOther={() => { setSelectedType('Other'); setCapturedImage(null); setOtherDescription(''); setStep('other-guidance') }} onBack={() => setStep('calling')} onContinue={() => setStep('photo')} />

  return <CallingScreen onBack={handleReturnHome} onContinue={() => setStep('types')} />
}

function CallingScreen({ onBack, onContinue }) {
  return <section className="mx-auto max-w-2xl text-center"><button className="back-link mx-auto" type="button" onClick={onBack}><ArrowLeft className="size-4" />Back home</button><div className="call-panel mt-8"><div className="call-icon"><PhoneCall className="size-7" /></div><p className="eyebrow mt-8">Step 1 of 4</p><h1 className="mt-3 text-4xl font-bold text-slate-950">Contacting Emergency Services</h1><p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">For immediate emergency support, call the national ambulance service now.</p><a className="phone-number" href="tel:108">108</a><p className="mt-2 text-sm text-slate-500">Tap the number to open your phone app.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><a className="call-button" href="tel:108"><PhoneCall className="size-5" />Call 108</a><button className="secondary-button justify-center" type="button" onClick={onContinue}>Continue<ArrowRight className="size-4" /></button></div><a className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 underline" href="tel:108"><PhoneCall className="size-4" />Call again</a><p className="mt-8 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">This prototype cannot confirm whether your call connected. Continue when you are ready to share the alert with nearby responders.</p></div></section>
}

function TypeSelection({ selectedType, onSelect, onChooseOther, onBack, onContinue }) {
  return <section className="mx-auto max-w-3xl"><button className="back-link" type="button" onClick={onBack}><ArrowLeft className="size-4" />Back to emergency services</button><div className="mt-8"><p className="eyebrow">Step 2 of 4</p><h1 className="mt-3 text-4xl font-bold text-slate-950">What is happening?</h1><p className="mt-3 text-lg text-slate-600">Choose the closest match so responders know what to expect.</p></div><div className="mt-8 grid gap-3 sm:grid-cols-2">{emergencyTypes.map(({ label, value, icon: Icon }) => <button className={`type-card ${selectedType === value ? 'selected' : ''}`} key={label} type="button" onClick={() => value === 'Other' ? onChooseOther() : onSelect(value)}><span className="type-icon"><Icon className="size-5" /></span><span>{label}</span></button>)}</div><button className="alert-button mt-8" type="button" disabled={!selectedType || selectedType === 'Other'} onClick={onContinue}>Continue to photo verification<ArrowRight className="size-5" /></button></section>
}

function CameraVerification({ capturedImage, onCapture, onBack, onContinue }) {
  const [cameraState, setCameraState] = useState(() => (capturedImage ? 'captured' : 'starting'))
  const [stream, setStream] = useState(null)
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const videoRef = useRef(null)

  useEffect(() => {
    let activeStream
    if (capturedImage) return undefined
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState('unsupported'); return undefined }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((nextStream) => { activeStream = nextStream; setStream(nextStream); setCameraState('ready') })
      .catch(() => setCameraState('denied'))
    return () => activeStream?.getTracks().forEach((track) => track.stop())
  }, [cameraAttempt, capturedImage])

  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream }, [stream])

  function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = document.createElement('canvas')
    const maxDimension = 1280
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.7))
    stream?.getTracks().forEach((track) => track.stop())
    setStream(null)
    setCameraState('captured')
  }

  return (
    <section className="mx-auto max-w-2xl">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft className="size-4" />Back to emergency type</button>
      <div className="mt-8">
        <p className="eyebrow">Step 3 of 4</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Photo verification</h1>
        <p className="mt-3 text-lg text-slate-600">Take a quick photo of the scene so responders can prepare.</p>
      </div>
      <div className="camera-panel mt-8">
        {capturedImage ? <img className="camera-preview" src={capturedImage} alt="Captured emergency scene" /> : <video className="camera-preview" ref={videoRef} autoPlay muted playsInline />}
        {cameraState === 'starting' && <div className="camera-message">Requesting camera access...</div>}
        {cameraState === 'denied' && <div className="camera-message"><Camera className="mx-auto size-7 text-[#df4d38]" /><strong className="mt-3 block text-slate-950">Camera access was not granted.</strong><span className="mt-2 block text-sm leading-6 text-slate-600">Allow camera access in your browser settings to take the mandatory verification photo.</span></div>}
        {cameraState === 'unsupported' && <div className="camera-message"><strong className="block text-slate-950">Camera access is unavailable here.</strong><span className="mt-2 block text-sm leading-6 text-slate-600">Open this prototype on localhost or HTTPS with a camera-capable browser.</span></div>}
      </div>
      {cameraState === 'captured' ? (
        <div className="mt-5 flex gap-3">
          <button className="secondary-button flex-1 justify-center" type="button" onClick={() => { onCapture(null); setCameraState('starting'); setCameraAttempt((attempt) => attempt + 1) }}>Retake</button>
          <button className="alert-button flex-1" type="button" onClick={onContinue}>Continue<ArrowRight className="size-5" /></button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button className="alert-button flex-1" type="button" disabled={cameraState !== 'ready'} onClick={capture}><Camera className="size-5" />Take photo</button>
        </div>
      )}
      {cameraState !== 'captured' && <p className="mt-5 text-center text-sm text-slate-500">Your photo will be shared with verified responders for this alert.</p>}
    </section>
  )
}

function OtherEmergencyAssistant({ capturedImage, onCapture, description, onDescription, onBack, onContinue }) {
  const [cameraState, setCameraState] = useState(capturedImage ? 'captured' : 'opening')
  const [stream, setStream] = useState(null)
  const [cameraAttempt, setCameraAttempt] = useState(capturedImage ? 0 : 1)
  const videoRef = useRef(null)

  useEffect(() => {
    if (!cameraAttempt) return undefined
    let activeStream
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState('unsupported'); return undefined }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((nextStream) => { activeStream = nextStream; setStream(nextStream); setCameraState('ready') })
      .catch(() => setCameraState('denied'))
    return () => activeStream?.getTracks().forEach((track) => track.stop())
  }, [cameraAttempt, capturedImage])

  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream }, [stream])

  function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.7))
    stream?.getTracks().forEach((track) => track.stop())
    setStream(null)
    setCameraState('captured')
  }

  const retakePhoto = () => { onCapture(null); setCameraState('opening'); setCameraAttempt((attempt) => attempt + 1) }

  return (
    <section className="mx-auto max-w-2xl">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft className="size-4" />Back to emergency type</button>
      <div className="mt-8">
        <p className="eyebrow">Step 3 of 4</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Other emergency</h1>
        <p className="mt-3 text-lg text-slate-600">Capture one photo for responders, then describe what happened.</p>
      </div>
      <div className="surface mt-8">
        <h2 className="text-lg font-bold text-slate-950">1. Capture Photo</h2>
        {capturedImage ? (
          <>
            <div className="confirmation-photo mt-4"><img src={capturedImage} alt="Captured emergency scene for responders" /></div>
            <button className="secondary-button mt-4" type="button" onClick={retakePhoto}>Retake photo</button>
          </>
        ) : (
          <>
            <div className="camera-panel mt-4">
              {cameraState === 'ready' ? <video className="camera-preview" ref={videoRef} autoPlay muted playsInline /> : <div className="camera-message">{cameraState === 'opening' ? 'Requesting camera access...' : cameraState === 'denied' ? 'Camera permission is required for an Other emergency. Allow camera access, then retry.' : 'Camera access is unavailable in this browser. Use a camera-capable browser over HTTPS or localhost, then retry.'}</div>}
            </div>
            {cameraState === 'ready' && <button className="alert-button mt-4" type="button" onClick={capture}><Camera className="size-5" />Capture photo</button>}
            {cameraState !== 'ready' && cameraState !== 'opening' && <button className="secondary-button mt-4" type="button" onClick={() => { setCameraState('opening'); setCameraAttempt((attempt) => attempt + 1) }}>Retry camera</button>}
          </>
        )}

        {capturedImage && <><label className="form-field mt-6" htmlFor="other-description">2. Describe what happened<textarea id="other-description" className="field-input min-h-32 resize-y" maxLength="240" placeholder="For example: The person fell down and is not responding." value={description} onChange={(event) => onDescription(event.target.value)} /></label><div className="mt-5 flex justify-end"><button className="alert-button" type="button" disabled={!description.trim()} onClick={onContinue}>Continue to location<ArrowRight className="size-5" /></button></div></>}
      </div>
    </section>
  )
}

function AlertConfirmation({ emergencyType, capturedImage, initialDescription, onBack, onSent }) {
  const [description, setDescription] = useState(initialDescription || '')
  const [location, setLocation] = useState(null)
  const [locationState, setLocationState] = useState('loading')
  const [submitState, setSubmitState] = useState('idle')
  const [error, setError] = useState('')

  function detectLocation() {
    if (!window.isSecureContext) { setLocationState('insecure'); return }
    if (!navigator.geolocation) { setLocationState('unsupported'); return }
    setError('')
    setLocationState('loading')
    requestCurrentLocation(({ coords }) => {
      setLocation({ latitude: coords.latitude, longitude: coords.longitude })
      setLocationState('success')
    }, (locationError) => {
      setLocationState(locationError.code === 1 ? 'denied' : locationError.code === 2 ? 'unavailable' : 'timeout')
    })
  }

  useEffect(() => { detectLocation() }, [])

  async function sendAlert() {
    if (!location) {
      setError('Wait for a location before sending the alert, then try again.')
      detectLocation()
      return
    }
    if (emergencyType === 'Other' && !description.trim()) {
      setError('Briefly describe what is happening so we can provide immediate guidance.')
      return
    }
    setSubmitState('loading'); setError('')
    try {
      const response = await fetch('/api/emergencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergency_type: emergencyType,
          description: description.slice(0, 240),
          latitude: location.latitude,
          longitude: location.longitude,
          scene_photo: capturedImage,
        }),
      })
      const result = await readApiJson(response, 'The server returned an invalid alert response. Please try again.')
      if (!response.ok) throw new Error(result.error || 'Unable to send alert.')
      onSent(result.emergency)
    } catch (requestError) {
      setSubmitState('error')
      setError(requestError.message)
    }
  }

  const typeLabel = emergencyTypes.find((type) => type.value === emergencyType)?.label || emergencyType

  return (
    <section className="mx-auto max-w-3xl">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft className="size-4" />Back to photo verification</button>
      <div className="mt-8">
        <p className="eyebrow">Step 4 of 4</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Confirm your emergency alert</h1>
        <p className="mt-3 text-lg text-slate-600">Review what will be shared with nearby responders.</p>
      </div>
      <div className="confirmation-grid mt-8">
        <div className="confirmation-panel">
          <div className="confirmation-summary mt-0">
            <span className="type-icon"><TriangleAlert className="size-5" /></span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Emergency type</span>
              <strong className="mt-1 block text-lg text-slate-950">{typeLabel}</strong>
            </div>
          </div>

          <label className="form-field mt-5" htmlFor="confirmation-description">Short description <span>(optional)</span>
            <textarea id="confirmation-description" className="field-input min-h-28 resize-y" maxLength="240" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>

          <div className="location-summary mt-5">
            <div className="flex items-center gap-2"><MapPin className="size-4 text-[#df4d38]" /><strong className="text-sm text-slate-950">Detected GPS location</strong></div>
            {location ? (
              <div className="mt-2 grid grid-cols-2 gap-3 font-mono text-xs text-slate-700">
                <span>Lat {location.latitude.toFixed(6)}</span>
                <span>Lng {location.longitude.toFixed(6)}</span>
              </div>
            ) : <p className="mt-2 text-sm text-red-700">Location is unavailable. Try again below.</p>}
            {locationState !== 'loading' && <button className="mt-3 text-xs font-bold text-slate-600 underline" type="button" onClick={detectLocation}>Try location again</button>}
          </div>

          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}

          <button className="alert-button mt-6 w-full" type="button" disabled={submitState === 'loading'} onClick={sendAlert}>
            {submitState === 'loading' ? 'Sending alert…' : 'Send Alert'}
          </button>
        </div>

        <div className="confirmation-media">
          <div className="confirmation-photo">{capturedImage && <img src={capturedImage} alt="Captured emergency scene" />}</div>
          {location && <EmergencyMap location={location} emergencies={[]} />}
        </div>
      </div>
    </section>
  )
}
