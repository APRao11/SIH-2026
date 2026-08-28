import { useState } from 'react'
import { Activity, CircleHelp, ShieldPlus, Siren } from 'lucide-react'
import AdminVerification from './components/AdminVerification'
import EmergencyFlow from './components/EmergencyFlow'
import ResponderDashboard from './components/ResponderDashboard'
import ResponderRegistration from './components/ResponderRegistration'
import './App.css'

function App() {
  const [view, setView] = useState('home')
  const [responder, setResponder] = useState(null)
  if (view === 'emergency') return <PageShell onHome={() => setView('home')} onResponder={() => setView('responder')} onAdmin={() => setView('admin')}><EmergencyFlow onBack={() => setView('home')} /></PageShell>
  if (view === 'register') return <PageShell onHome={() => setView('home')} onResponder={() => setView('responder')} onAdmin={() => setView('admin')}><ResponderRegistration onRegistered={setResponder} /></PageShell>
  if (view === 'responder') return <PageShell onHome={() => setView('home')} onResponder={() => setView('responder')} onAdmin={() => setView('admin')}><ResponderDashboard responder={responder} /></PageShell>
  if (view === 'admin') return <PageShell onHome={() => setView('home')} onResponder={() => setView('responder')} onAdmin={() => setView('admin')}><AdminVerification /></PageShell>
  return <PageShell onHome={() => setView('home')} onResponder={() => setView('responder')} onAdmin={() => setView('admin')}><section className="home-hero"><div className="hero-copy"><p className="eyebrow">Community-assisted response</p><h1 className="mt-4 text-5xl font-bold leading-[.98] tracking-[-.04em] text-slate-950 sm:text-7xl">Help can start with one clear step.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">Connect people in an emergency with the right next action and trained community responders nearby.</p></div><div className="home-actions"><button className="home-action emergency-action" type="button" onClick={() => setView('emergency')}><span className="action-icon"><Siren className="size-6" /></span><span><strong>Send Emergency Alert</strong><small>Call 108, then share the situation with nearby responders.</small></span></button><button className="home-action responder-action" type="button" onClick={() => setView('register')}><span className="action-icon"><ShieldPlus className="size-6" /></span><span><strong>Register as Responder</strong><small>Join the community network as a verified helper.</small></span></button></div><div className="home-note"><span className="note-line" />Prototype MVP: emergency alerts are shared with this platform only after you choose to continue.</div></section></PageShell>
}

function PageShell({ children, onHome, onResponder, onAdmin }) {
  return <main className="min-h-screen overflow-hidden bg-[#f7f8f6] text-slate-900"><div className="ambient-shape ambient-shape-one" /><div className="ambient-shape ambient-shape-two" /><header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10"><button className="flex items-center gap-3" type="button" onClick={onHome}><span className="brand-mark"><Activity className="size-5" strokeWidth={2.5} /></span><span className="text-sm font-bold tracking-wide text-slate-950">COMMUNITY RESPONSE</span></button><div className="flex items-center gap-3"><button className="quiet-link hidden sm:block" type="button" onClick={onResponder}>Responder tools</button><button className="quiet-link hidden sm:block" type="button" onClick={onAdmin}>Admin</button><button className="help-button" type="button" aria-label="Get help"><CircleHelp className="size-5" /></button></div></header><section className="relative mx-auto max-w-6xl px-6 pb-16 pt-12 lg:px-10 lg:pb-24 lg:pt-16">{children}</section><footer className="relative border-t border-slate-200/80"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-10"><span>SIH 2026 MVP</span><span>Prototype workflow for community-assisted response.</span></div></footer></main>
}

export default App
