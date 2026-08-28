import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, Flame, HeartPulse, PhoneCall, TriangleAlert, UserRound, Waves } from 'lucide-react'
import EmergencyAlertForm from './EmergencyAlertForm'

const emergencyTypes = [
  { label: 'Road Accident', value: 'Accident', icon: TriangleAlert },
  { label: 'Cardiac Emergency', value: 'Cardiac emergency', icon: HeartPulse },
  { label: 'Fire / Burn', value: 'Burns', icon: Flame },
  { label: 'Unconscious Person', value: 'Other', icon: UserRound },
  { label: 'Other', value: 'Other', icon: Waves },
]

export default function EmergencyFlow({ onBack }) {
  const [step, setStep] = useState('calling')
  const [selectedType, setSelectedType] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)

  if (step === 'details') return <section><button className="back-link" type="button" onClick={() => setStep('types')}><ArrowLeft className="size-4" />Back to emergency type</button><div className="mb-10 mt-8 max-w-2xl"><p className="eyebrow">Emergency alert</p><h1 className="mt-3 text-4xl font-bold text-slate-950">Share the details responders need.</h1></div><EmergencyAlertForm initialEmergencyType={selectedType} /></section>

  if (step === 'confirmation') return <section className="mx-auto max-w-2xl"><button className="back-link" type="button" onClick={() => setStep('photo')}><ArrowLeft className="size-4" />Back to photo verification</button><div className="confirmation-panel mt-8"><div className="confirmation-icon"><Check className="size-6" /></div><p className="eyebrow mt-7">Alert confirmation</p><h1 className="mt-3 text-4xl font-bold text-slate-950">Ready to share this alert?</h1><p className="mt-3 text-base leading-7 text-slate-600">Review the emergency type below, then add your location and any helpful details.</p><div className="confirmation-summary"><span className="type-icon"><Camera className="size-5" /></span><div><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Emergency type</span><strong className="mt-1 block text-lg text-slate-950">{emergencyTypes.find((type) => type.value === selectedType)?.label}</strong></div></div><button className="alert-button mt-7" type="button" onClick={() => setStep('details')}>Continue to alert details<ArrowRight className="size-5" /></button><p className="mt-4 text-center text-xs text-slate-500">Your photo remains on this device and is not uploaded in this MVP.</p></div></section>

  if (step === 'photo') return <CameraVerification capturedImage={capturedImage} onCapture={setCapturedImage} onBack={() => setStep('types')} onContinue={() => setStep('confirmation')} />

  if (step === 'types') return <section className="mx-auto max-w-3xl"><button className="back-link" type="button" onClick={() => setStep('calling')}><ArrowLeft className="size-4" />Back to emergency services</button><div className="mt-8"><p className="eyebrow">Step 2 of 4</p><h1 className="mt-3 text-4xl font-bold text-slate-950">What is happening?</h1><p className="mt-3 text-lg text-slate-600">Choose the closest match so responders know what to expect.</p></div><div className="mt-8 grid gap-3 sm:grid-cols-2">{emergencyTypes.map(({ label, value, icon: Icon }) => <button className={`type-card ${selectedType === value ? 'selected' : ''}`} key={label} type="button" onClick={() => setSelectedType(value)}><span className="type-icon"><Icon className="size-5" /></span><span>{label}</span></button>)}</div><button className="alert-button mt-8" type="button" disabled={!selectedType} onClick={() => setStep('photo')}>Continue to photo verification<ArrowRight className="size-5" /></button></section>

  return <section className="mx-auto max-w-2xl text-center"><button className="back-link mx-auto" type="button" onClick={onBack}><ArrowLeft className="size-4" />Back home</button><div className="call-panel mt-8"><div className="call-icon"><PhoneCall className="size-7" /></div><p className="eyebrow mt-8">Step 1 of 2</p><h1 className="mt-3 text-4xl font-bold text-slate-950">Contacting Emergency Services</h1><p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">For immediate emergency support, call the national ambulance service now.</p><a className="phone-number" href="tel:108">108</a><p className="mt-2 text-sm text-slate-500">Tap the number to open your phone app.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><a className="call-button" href="tel:108"><PhoneCall className="size-5" />Call 108</a><button className="secondary-button justify-center" type="button" onClick={() => setStep('types')}>Continue<ArrowRight className="size-4" /></button></div><a className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 underline" href="tel:108"><PhoneCall className="size-4" />Call again</a><p className="mt-8 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">This prototype cannot confirm whether your call connected. Continue when you are ready to share the alert with nearby responders.</p></div></section>
}

function CameraVerification({ capturedImage, onCapture, onBack, onContinue }) {
  const [cameraState, setCameraState] = useState('starting')
  const [stream, setStream] = useState(null)
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const videoRef = useRef(null)

  useEffect(() => {
    let activeStream
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState('unsupported'); return undefined }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((nextStream) => { activeStream = nextStream; setStream(nextStream); setCameraState('ready') })
      .catch(() => setCameraState('denied'))
    return () => activeStream?.getTracks().forEach((track) => track.stop())
  }, [cameraAttempt])

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream])

  function capture() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    onCapture(canvas.toDataURL('image/jpeg', 0.85))
    stream?.getTracks().forEach((track) => track.stop())
    setStream(null)
    setCameraState('captured')
  }

  return <section className="mx-auto max-w-2xl"><button className="back-link" type="button" onClick={onBack}><ArrowLeft className="size-4" />Back to emergency type</button><div className="mt-8"><p className="eyebrow">Step 3 of 4</p><h1 className="mt-3 text-4xl font-bold text-slate-950">Photo verification</h1><p className="mt-3 text-lg text-slate-600">Take a quick photo of the scene so responders can prepare.</p></div><div className="camera-panel mt-8">{capturedImage ? <img className="camera-preview" src={capturedImage} alt="Captured emergency scene" /> : <video className="camera-preview" ref={videoRef} autoPlay muted playsInline />}{cameraState === 'starting' && <div className="camera-message">Requesting camera access...</div>}{cameraState === 'denied' && <div className="camera-message"><Camera className="mx-auto size-7 text-[#df4d38]" /><strong className="mt-3 block text-slate-950">Camera access was not granted.</strong><span className="mt-2 block text-sm leading-6 text-slate-600">Allow camera access in your browser settings to take a verification photo. You can still go back and review the emergency type.</span></div>}{cameraState === 'unsupported' && <div className="camera-message"><strong className="block text-slate-950">Camera access is unavailable here.</strong><span className="mt-2 block text-sm leading-6 text-slate-600">Open this prototype on localhost or HTTPS with a camera-capable browser.</span></div>}</div>{cameraState === 'captured' ? <div className="mt-5 flex gap-3"><button className="secondary-button flex-1 justify-center" type="button" onClick={() => { onCapture(null); setCameraState('starting'); setCameraAttempt((attempt) => attempt + 1) }}>Retake</button><button className="alert-button flex-1" type="button" onClick={onContinue}>Continue<ArrowRight className="size-5" /></button></div> : <button className="alert-button mt-5" type="button" disabled={cameraState !== 'ready'} onClick={capture}><Camera className="size-5" />Take photo</button>}<p className="mt-4 text-center text-xs text-slate-500">The image is stored temporarily in this session and is not uploaded.</p></section>
}