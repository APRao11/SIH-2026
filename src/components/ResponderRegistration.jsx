import { useState } from 'react'
import { Check, FileUp, UserPlus } from 'lucide-react'

const roles = ['Doctor', 'Medical Student', 'Trained Volunteer']

export default function ResponderRegistration({ onRegistered }) {
  const [form, setForm] = useState({ name: '', identity_id: '', institution: '', phone: '', email: '', role: roles[0], qualification: '', password: '' })
  const [document, setDocument] = useState(null)
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')
  function updateField(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  async function submit(event) {
    event.preventDefault()
    if (!document) { setState('error'); setMessage('Please upload a verification document.'); return }
    setState('loading'); setMessage('')
    const body = new FormData()
    Object.entries(form).forEach(([key, value]) => body.append(key, value))
    body.append('verificationDocument', document)
    try {
      const response = await fetch('/api/responders', { method: 'POST', body })
      const payload = await response.text()
      let result = {}
      try { result = payload ? JSON.parse(payload) : {} } catch { /* The proxy/server may return an HTML error page. */ }
      if (!response.ok) {
        throw new Error(result.error || `Registration service is unavailable (HTTP ${response.status}). Start the app with npm run dev and try again.`)
      }
      if (!result.responder) throw new Error('Registration did not return responder details. Please try again.')
      localStorage.setItem('responderId', String(result.responder.id))
      setState('success')
      onRegistered(result.responder)
    } catch (error) { setState('error'); setMessage(error.message || 'Registration failed.') }
  }
  if (state === 'success') return <section className="surface max-w-2xl text-center"><div className="confirmation-icon"><Check className="size-6" /></div><p className="eyebrow mt-8">Verification pending</p><h1 className="mt-3 text-3xl font-bold text-slate-950">Your details have been submitted for institutional verification.</h1><p className="mt-4 text-base leading-7 text-slate-600">Your account will become active after verification.</p><p className="mt-6 text-sm text-slate-500">An admin will review your registration and uploaded document.</p></section>
  return <section className="surface max-w-2xl"><div className="section-heading"><div className="icon-box"><UserPlus className="size-5" /></div><div><p className="eyebrow">Responder onboarding</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Register as Responder</h1><p className="mt-2 text-sm leading-6 text-slate-600">Submit your details for institutional verification. Your account starts offline and unverified.</p></div></div><form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={submit}><label className="form-field sm:col-span-2">Full name<input className="field-input" name="name" required value={form.name} onChange={updateField} /></label><label className="form-field">Student ID / Doctor ID<input className="field-input" name="identity_id" required value={form.identity_id} onChange={updateField} /></label><label className="form-field">Institution / Hospital<input className="field-input" name="institution" required value={form.institution} onChange={updateField} /></label><label className="form-field">Phone number<input className="field-input" name="phone" required value={form.phone} onChange={updateField} /></label><label className="form-field">Email<input className="field-input" type="email" name="email" required value={form.email} onChange={updateField} /></label><label className="form-field">Responder type<select className="field-input" name="role" value={form.role} onChange={updateField}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><label className="form-field">Qualification / details<input className="field-input" name="qualification" required value={form.qualification} onChange={updateField} placeholder="MBBS, year of study, training" /></label><label className="form-field sm:col-span-2">Password<input className="field-input" type="password" name="password" minLength="8" required value={form.password} onChange={updateField} placeholder="At least 8 characters" /></label><label className="upload-field sm:col-span-2"><FileUp className="size-5 text-[#df4d38]" /><span><strong>Verification document</strong><small>{document ? document.name : 'PDF, JPG, or PNG up to 5 MB'}</small></span><input type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={(event) => setDocument(event.target.files[0])} /></label>{message && <p className="sm:col-span-2 text-sm font-medium text-red-700" role="alert">{message}</p>}<button className="alert-button sm:col-span-2" type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'Submitting registration...' : 'Submit registration'}</button></form></section>
}
