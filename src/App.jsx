import { Activity, CircleHelp } from 'lucide-react'
import EmergencyAlertForm from './components/EmergencyAlertForm'
import './App.css'

function App() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8f6] text-slate-900"><div className="ambient-shape ambient-shape-one" /><div className="ambient-shape ambient-shape-two" /><header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10"><div className="flex items-center gap-3"><div className="brand-mark"><Activity className="size-5" strokeWidth={2.5} /></div><span className="text-sm font-bold tracking-wide text-slate-950">COMMUNITY RESPONSE</span></div><button className="help-button" type="button" aria-label="Get help"><CircleHelp className="size-5" /></button></header><section className="relative mx-auto max-w-6xl px-6 pb-16 pt-12 lg:px-10 lg:pb-24 lg:pt-20"><div className="mb-12 max-w-2xl"><p className="eyebrow">Bystander alert</p><h1 className="mt-4 max-w-xl text-5xl font-bold leading-[.98] tracking-[-.04em] text-slate-950 sm:text-6xl">Get the right help moving.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">Send a nearby responder the essentials in seconds. Stay with the person while help is coordinated.</p></div><EmergencyAlertForm /></section><footer className="relative border-t border-slate-200/80"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-10"><span>SIH 2026 MVP</span><span>For immediate danger, use your local emergency services.</span></div></footer></main>
  )
}

export default App
