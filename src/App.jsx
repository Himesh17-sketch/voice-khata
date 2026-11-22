import { useState, useEffect } from 'react'

const PAY_WORDS = ['jama', 'wapas', 'vapas', 'paid', 'chuka', 'payment', 'जमा', 'वापस', 'चुका', 'de diye', 'de diya', 'दे दिए', 'दे दिया']
const PARTICLES = ['ko', 'ne', 'se', 'ka', 'ke', 'को', 'ने', 'से', 'का', 'के']

function parse(text) {
  const t = text.toLowerCase().trim()
  const m = t.match(/\d+/)
  if (!m) return null
  const amount = parseInt(m[0], 10)
  let words = t.slice(0, m.index).trim().split(/\s+/)
  while (words.length && PARTICLES.includes(words[words.length - 1])) words.pop()
  const name = words.join(' ')
  if (!name) return null
  const type = PAY_WORDS.some((w) => t.includes(w)) ? 'jama' : 'udhaar'
  return { name, amount, type }
}

export default function App() {
  const [entries, setEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem('khata')) || [] } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')
  const [listening, setListening] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('khata', JSON.stringify(entries)) } catch {}
  }, [entries])

  const addFromText = (text) => {
    const p = parse(text)
    if (!p) { setMsg('Samajh nahi aaya. Aise bolo: "Ramesh ko 200 udhaar"'); return }
    setEntries((e) => [{ ...p, id: Date.now(), time: new Date().toLocaleString() }, ...e])
    setMsg(`${p.name}: ₹${p.amount} ${p.type} add ho gaya ✅`)
    setInput('')
  }

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMsg('Is browser mein voice nahi chalta, Chrome use karo'); return }
    const r = new SR()
    r.lang = 'hi-IN'
    r.onresult = (e) => {
      const text = e.results[0][0].transcript
      setMsg(`Suna: "${text}"`)
      addFromText(text)
    }
    r.onerror = () => { setListening(false); setMsg('Mic error. Mic permission Allow karo.') }
    r.onend = () => setListening(false)
    setListening(true)
    r.start()
  }

  const totals = {}
  entries.forEach((e) => {
    totals[e.name] = (totals[e.name] || 0) + (e.type === 'udhaar' ? e.amount : -e.amount)
  })

  return (
    <div className="app">
      <h1>🎙️ Voice Khata</h1>
      <p className="sub">Kirana store ka voice udhaar ledger (Hindi / Hinglish)</p>

      <button className={`mic ${listening ? 'on' : ''}`} onClick={startListening}>
        {listening ? 'Sun raha hoon...' : '🎤 Bolo'}
      </button>

      <div className="row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFromText(input)}
          placeholder='Ya type karo: Ramesh ko 200 udhaar'
        />
        <button onClick={() => addFromText(input)}>Add</button>
      </div>
      {msg && <p className="msg">{msg}</p>}

      <h2>Baaki Hisaab</h2>
      {Object.keys(totals).length === 0 && <p className="sub">Abhi koi entry nahi.</p>}
      {Object.entries(totals).map(([name, amt]) => (
        <div className="card" key={name}>
          <span className="name">{name}</span>
          <span className={amt > 0 ? 'owe' : 'clear'}>₹{amt}</span>
        </div>
      ))}

      <h2>History</h2>
      {entries.map((e) => (
        <div className="card small" key={e.id}>
          <span>{e.name} · {e.type}</span>
          <span>₹{e.amount}</span>
        </div>
      ))}
    </div>
  )
}
