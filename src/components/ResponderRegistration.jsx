import { useState } from 'react'
import { FileUp, UserPlus } from 'lucide-react'

const roles = ['Doctor', 'Medical Student', 'Trained Volunteer']

export default function ResponderRegistration({ onRegistered }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: roles[0], qualification: '', password: '' })
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
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      localStorage.setItem('responderId', String(result.responder.id))
      setState('success'); setMessage('Registration received. An admin must verify your documents before you can go online.')
      onRegistered(result.responder)
    } catch (error) { setState('error'); setMessage(error.message || 'Registration failed.') }
  }

  return <section className="surface max-w-2xl"><div className="section-heading"><div className="icon-box"><UserPlus className="size-5" /></div><div><p className="eyebrow">Responder onboarding</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Register to help nearby</h1><p className="mt-2 text-sm leading-6 text-slate-600">Your details stay in the response system and are reviewed by an admin.</p></div></div><form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={submit}><label className="form-field sm:col-span-2">Full name<input className="field-input" name="name" required value={form.name} onChange={updateField} placeholder="Aarav Sharma" /></label><label className="form-field">Phone number<input className="field-input" name="phone" required value={form.phone} onChange={updateField} placeholder="+91 98765 43210" /></label><label className="form-field">Email<input className="field-input" type="email" name="email" required value={form.email} onChange={updateField} placeholder="you@example.com" /></label><label className="form-field">Role<select className="field-input" name="role" value={form.role} onChange={updateField}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><label className="form-field">Qualification / College<input className="field-input" name="qualification" required value={form.qualification} onChange={updateField} placeholder="MBBS, City Medical College" /></label><label className="form-field sm:col-span-2">Password<input className="field-input" type="password" name="password" minLength="8" required value={form.password} onChange={updateField} placeholder="At least 8 characters" /></label><label className="upload-field sm:col-span-2"><FileUp className="size-5 text-[#df4d38]" /><span><strong>Verification document</strong><small>{document ? document.name : 'PDF, JPG, or PNG up to 5 MB'}</small></span><input type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={(event) => setDocument(event.target.files[0])} /></label>{message && <p className={`sm:col-span-2 text-sm font-medium ${state === 'error' ? 'text-red-700' : 'text-emerald-700'}`} role="alert">{message}</p>}<button className="alert-button sm:col-span-2" type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'Submitting registration...' : 'Submit registration'}</button></form></section>
}