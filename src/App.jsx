import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Helpers ---------- */
const KEY = "voice-khata-v2";
const uid = () => Math.random().toString(36).slice(2, 9);
const dateStr = (ago = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - ago);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const rupee = (n) => "₹" + Number(n).toLocaleString("en-IN");
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const STARTER = {
  customers: [
    { id: "c1", name: "Ramesh", optIn: false },
    { id: "c2", name: "Suresh", optIn: false },
    { id: "c3", name: "Amit", optIn: false },
  ],
  entries: [
    { id: "e1", customerId: "c1", customerName: "Ramesh", type: "credit", amount: 340, date: dateStr(), note: "demo", createdAt: 1 },
    { id: "e2", customerId: "c2", customerName: "Suresh", type: "credit", amount: 500, date: dateStr(), note: "demo", createdAt: 2 },
    { id: "e3", customerId: "c2", customerName: "Suresh", type: "payment", amount: 200, date: dateStr(), note: "demo", createdAt: 3 },
  ],
};

function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : null;
    if (d && Array.isArray(d.customers) && Array.isArray(d.entries)) return d;
  } catch {}
  return STARTER;
}

const balanceOf = (entries, id) =>
  entries.filter((e) => e.customerId === id).reduce((s, e) => s + (e.type === "credit" ? e.amount : -e.amount), 0);

const labelOf = (c, customers) => {
  const same = customers.filter((x) => x.name.toLowerCase() === c.name.toLowerCase());
  return same.length > 1 ? `${c.name} (${same.indexOf(c) + 1})` : c.name;
};

/* ---------- Devanagari -> Roman (so Hindi script bhi samajh aaye) ---------- */
const CONS = { क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n", ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n", प: "p", फ: "f", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h" };
const VOW = { अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o", ऋ: "ri" };
const MAT = { "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ृ": "ri" };

function translit(s) {
  s = s.normalize("NFD").replace(/\u093C/g, "").replace(/[०-९]/g, (c) => "०१२३४५६७८९".indexOf(c));
  const ch = [...s];
  let out = "";
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i], n = ch[i + 1];
    if (CONS[c]) {
      out += CONS[c];
      if (n === "्") { i++; continue; }
      if (MAT[n]) continue;
      if (n && (CONS[n] || VOW[n] || "ंँः".includes(n))) out += "a";
    } else if (MAT[c]) out += MAT[c];
    else if (VOW[c]) out += VOW[c];
    else if (c === "ं" || c === "ँ") out += "n";
    else if (c === "ः") out += "h";
    else if (c === "।") out += " ";
    else out += c;
  }
  return out;
}

/* ---------- Numbers: "teen sau chaalis", "three forty", "340" ---------- */
const NUMW = { ek: 1, one: 1, do: 2, two: 2, teen: 3, tin: 3, three: 3, char: 4, chaar: 4, four: 4, paanch: 5, panch: 5, five: 5, chhe: 6, che: 6, chhah: 6, six: 6, saat: 7, sat: 7, seven: 7, aath: 8, ath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10, gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17, atharah: 18, unnis: 19, bees: 20, bis: 20, twenty: 20, pachchis: 25, pachis: 25, tees: 30, tis: 30, thirty: 30, chalis: 40, chaalis: 40, forty: 40, pachas: 50, pachaas: 50, fifty: 50, saath: 60, sath: 60, sixty: 60, sattar: 70, seventy: 70, assi: 80, eighty: 80, nabbe: 90, ninety: 90, sau: 100, hundred: 100, hazaar: 1000, hazar: 1000, hajar: 1000, thousand: 1000, lakh: 100000 };
const AMBIG = new Set(["ek", "do", "one", "two"]);
const isNum = (t) => /^\d+$/.test(t);

function mergeNumbers(tokens) {
  const out = [];
  let cur = 0, total = 0, active = false, last = 0;
  const flush = () => { if (active) out.push(String(total + cur)); cur = total = last = 0; active = false; };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = NUMW[tokens[i + 1]];
    if (isNum(t)) {
      if (next >= 100) { cur += parseInt(t, 10); active = true; last = cur; continue; }
      flush(); out.push(t); continue;
    }
    const v = NUMW[t];
    if (v === undefined) { flush(); out.push(t); continue; }
    if (AMBIG.has(t) && !active && !(next >= 100)) { out.push(t); continue; }
    if (v === 100) cur = (cur || 1) * 100;
    else if (v >= 1000) { total += (cur || 1) * v; cur = 0; }
    else if (cur === last && cur >= 1 && cur < 10 && total === 0 && v >= 20 && v % 10 === 0) cur = cur * 100 + v; // "three forty"
    else cur += v;
    active = true; last = v;
  }
  flush();
  return out;
}

const CORR = new Set(["nahi", "nahin", "nahe", "galat", "sorry", "matlab", "wrong", "actually"]);
const CONJ = new Set(["aur", "and", "phir", "then"]);
const CANCELW = new Set(["cancel", "rehne", "rahne", "chhodo", "chodo", "ruko"]);
const TYPEW = /^(udhaa?r[i]?|credit|baaki|baki|likh|likho|liya|liye|lekar|diy[ae]|dia|jama|wapas|vapas|chukaya|chuka|paid|payment|received|mila|aaya|aaye|return)$/;
const DATEW = /^(kal|aaj|aj|parso|parason|narso|abhi|subah|shaam)$/;
const STOP = new Set("add ad aid aad ed jod jodo jodna karna karana karni kar karo kardo karde daal daalo dalo darj mujhe mujhko chahiye chahta chahte hu hoon main mai naya new customer naam dijiye dijiyega bolo ka ki ke ko ne se me mein hai hain tha thi the ho hua gaya gaye gayi aur or and phir rupaye rupee rupees rupiya rs inr nahi nahin nahe sorry matlab correction galat total kitna kitni kitne kitana kul balance hisab hisaab bata batao batana do dena de dedo kya kisne kaun kaunsa kis kiska kisko bol please plz ji jee bhai sir ek hmm sab sabka sabhi hi bhi to toh yeh ye wo woh wala wali ab abhi list hatao hata delete undo mita mitao remove last pichli pichla aakhri entry".split(" "));
const isWord = (t) => /^[a-z]{2,}$/.test(t) && !STOP.has(t) && !TYPEW.test(t) && !DATEW.test(t) && NUMW[t] === undefined;

function tokenize(raw) {
  let s = translit(String(raw)).toLowerCase();
  s = s.replace(/(\d),(\d{3})/g, "$1$2").replace(/₹|\brs\b\.?|\brupee?s?\b|\brupaye\b|\binr\b/g, " ");
  s = s.replace(/[-]/g, " ").replace(/[,;]/g, " , ").replace(/[^a-z0-9, ]/g, " ");
  const toks = mergeNumbers(s.split(/\s+/).filter(Boolean));
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    // "Ramesh ka 340 udhaar, nahi 430" -> purana amount hata ke naya rakho
    if (CORR.has(toks[i]) && toks.slice(i + 1, i + 4).some(isNum)) {
      const k = out.map(isNum).lastIndexOf(true);
      if (k >= 0) { out.splice(k, 1); continue; }
    }
    out.push(toks[i]);
  }
  return out;
}

function detectType(tokens) {
  const j = tokens.join(" ");
  if (/wapas|vapas|jama|chukaya|chuka|paid|payment|received|return|lauta/.test(j)) return "payment";
  if (/\bse\b/.test(j) && /liy[ae]/.test(j)) return "payment";
  if (/udhaa?r|credit|baaki|baki|likh|liya|liye|lekar/.test(j)) return "credit";
  if (/\b(diy[ae]|dia|mila|aaya|aaye)\b/.test(j)) return /\bko\b/.test(j) ? "credit" : "payment";
  return null;
}

function splitClauses(tokens) {
  const clauses = [];
  let cur = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const restHasNum = tokens.slice(i + 1).some(isNum);
    if (t === "," || CONJ.has(t)) {
      if (cur.some(isNum) && restHasNum) { clauses.push(cur); cur = []; }
      continue;
    }
    cur.push(t);
    if (TYPEW.test(t) && cur.some(isNum) && restHasNum) { clauses.push(cur); cur = []; }
  }
  if (cur.length) clauses.push(cur);
  const withNum = clauses.filter((c) => c.some(isNum));
  return withNum.length ? withNum : clauses;
}

function parseClause(toks) {
  const j = toks.join(" ");
  const daysAgo = /\bpar(a)?so|\bnar(a)?so/.test(j) ? 2 : /\bkal\b/.test(j) ? 1 : 0;
  return {
        name: (() => {
      const p = toks.findIndex((t) => ["ka", "ki", "ke", "ko", "ne", "se"].includes(t));
      const before = p > 0 ? toks.slice(0, p).filter(isWord).slice(-2) : [];
      return before.length ? before : toks.filter(isWord).slice(0, 2);
    })(),
    amount: Number(toks.find(isNum)),
        type: detectType(toks) || "credit",
    daysAgo,
    customerId: null,
    src: toks.join(" "),
  };
}

/* ---------- Naam matching (typo + do same naam) ---------- */
function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
const close = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && lev(a, b) <= 1);

function resolveCustomer(tokens, customers) {
  if (!tokens.length) return {};
  const attempt = (ts) =>
    customers
      .map((c) => {
        const ct = c.name.toLowerCase().split(/\s+/);
        let exact = 0;
        for (const s of ts) {
          if (ct.includes(s)) exact++;
          else if (!ct.some((x) => close(x, s))) return null;
        }
        return { c, exact, full: exact === ts.length && ct.length === ts.length };
      })
      .filter(Boolean);
  let cands = attempt(tokens);
  if (!cands.length && tokens.length > 1) cands = attempt([tokens[0]]);
  if (!cands.length) return {};
  const best = Math.max(...cands.map((x) => x.exact));
  cands = cands.filter((x) => x.exact === best);
  const full = cands.filter((x) => x.full);
  if (full.length === 1) return { customer: full[0].c };
  if (full.length > 1) cands = full;
  if (cands.length === 1) return { customer: cands[0].c };
  return { ambiguous: true, options: cands.map((x) => x.c.id) };
}

const ORD = [/(pehl|pahal|first|\b1\b|\bek\b|\bone\b)/, /(dus(a)?r|doos(a)?r|second|\b2\b|\bdo\b|\btwo\b)/, /(tis(a)?r|teesr|third|\b3\b)/];
const DISC = {
  "hi-IN": "Namaste! Main ek AI voice sahayak hoon, insaan nahi. Aap bolkar udhaar ya payment darj kar sakte hain.",
  "en-IN": "Hello! I am an AI voice assistant, not a human. You can speak to record credit or payments.",
};

/* ---------- App ---------- */
export default function App() {
  const [data, setData] = useState(loadData);
  const [lang, setLang] = useState("hi-IN");
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Mic dabayein aur bolein: \"Ramesh ka 340 udhaar\"");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [pending, setPendingState] = useState(null);
  const [typed, setTyped] = useState("");
  const [newName, setNewName] = useState("");

  const dataRef = useRef(data);
  const pendingRef = useRef(null);
  const langRef = useRef(lang);
  const introRef = useRef(false);
  const recRef = useRef(null);
  langRef.current = lang;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  const commit = (d) => { dataRef.current = d; setData(d); };
  const setPending = (p) => { pendingRef.current = p; setPendingState(p); };

  function say(msg, listenAfter = false) {
    if (!introRef.current) {
      introRef.current = true;
      msg = (DISC[langRef.current] + " " + msg).trim();
    }
    setReply(msg);
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = "en-IN";
    u.rate = 1.05;
    u.onend = () => { if (listenAfter || pendingRef.current) startListening(); };
    window.speechSynthesis.speak(u);
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus("Is browser me mic support nahi hai. Chrome use karein ya neeche type karein."); return; }
    try { recRef.current && recRef.current.abort(); } catch {}
    const r = new SR();
    r.lang = langRef.current;
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.continuous = false;
    r.onstart = () => { setListening(true); setStatus("Sun raha hoon..."); };
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      setTranscript(res[0].transcript);
      if (res.isFinal) {
        const alts = Array.from(res).map((a) => a.transcript);
        const best = pendingRef.current ? alts[0] : alts.find((a) => tokenize(a).some(isNum)) ?? alts[0];
        setTranscript(best);
        handle(best);
      }
    };
    r.onerror = (e) => {
      setListening(false);
      setStatus(
        e.error === "not-allowed" ? "Mic ki permission do (address bar ke lock icon se)." :
        e.error === "no-speech" ? "Kuch sunai nahi diya, phir bolein." : "Mic error: " + e.error
      );
    };
    r.onend = () => setListening(false);
    recRef.current = r;
    try { r.start(); } catch {}
  }

  function toggleMic() {
    if (listening) { try { recRef.current.stop(); } catch {} return; }
    if (!introRef.current) { say("", true); return; } // pehli baar: AI disclosure bolo, phir suno
    window.speechSynthesis && window.speechSynthesis.cancel();
    startListening();
  }

  /* ----- Core: bola hua text -> ledger ----- */
  function handle(raw) {
    const tokens = tokenize(raw);
    if (!tokens.length) return;
    if (pendingRef.current) return answerPending(tokens);
    const hasNum = tokens.some(isNum);
    const j = tokens.join(" ");

    if (!hasNum && /(hatao|hata|delete|undo|mita|mitao|remove)/.test(j)) return undoLast();
    if (CORR.has(tokens[0]) && (hasNum || detectType(tokens.slice(1)))) return correctLast(tokens.slice(1));
    if (hasNum) {
      const clauses = splitClauses(tokens).map(parseClause);
      return runClauses(clauses, 0, { lastId: null }, []);
    }
    return answerQuery(tokens);
  }

  function runClauses(clauses, idx, ctx, msgs) {
    let d = dataRef.current;
    for (let i = idx; i < clauses.length; i++) {
      const c = clauses[i];
      let cust = c.customerId ? d.customers.find((x) => x.id === c.customerId) : null;
      if (!cust) {
        if (c.name.length) {
          const r = resolveCustomer(c.name, d.customers);
          if (r.ambiguous) {
            commit(d);
            const names = r.options.map((id) => labelOf(d.customers.find((x) => x.id === id), d.customers));
            setPending({ kind: "customer", options: r.options, clauses, idx: i, ctx, msgs });
            return say([...msgs, `Kaunsa? ${names.join(" ya ")}?`].join(" "));
          }
          if (r.customer) cust = r.customer;
          else {
            cust = { id: uid(), name: titleCase(c.name.join(" ")), optIn: false };
            d = { ...d, customers: [...d.customers, cust] };
            msgs.push(`Naya customer ${cust.name} jod diya.`);
          }
        } else if (ctx.lastId) cust = d.customers.find((x) => x.id === ctx.lastId);
        else {
          commit(d);
          setPending({ kind: "name", clauses, idx: i, ctx, msgs });
          return say("Kiska hisaab hai?");
        }
      }
      if (!c.type) {
        commit(d);
        c.customerId = cust.id;
        setPending({ kind: "type", clauses, idx: i, ctx, msgs });
        return say([...msgs, `${cust.name} ke ${c.amount} rupaye udhaar the ya payment?`].join(" "));
      }
      const entry = { id: uid(), customerId: cust.id, customerName: cust.name, type: c.type, amount: c.amount, date: dateStr(c.daysAgo), note: c.src, createdAt: Date.now() };
      d = { ...d, entries: [...d.entries, entry] };
      ctx.lastId = cust.id;
      const bal = balanceOf(d.entries, cust.id);
      msgs.push(
        (c.type === "credit" ? `${cust.name} ka ${c.amount} rupaye udhaar likh diya.` : `${cust.name} se ${c.amount} rupaye payment mil gaya.`) +
        (bal >= 0 ? ` Kul baaki ${bal} rupaye.` : ` ${cust.name} ke ${-bal} rupaye zyada jama hain.`)
      );
    }
    commit(d);
    setPending(null);
    setStatus("Ho gaya. Agli entry bolein.");
    say(msgs.join(" "));
  }

  function answerPending(tokens) {
    const p = pendingRef.current;
    const d = dataRef.current;
    const j = tokens.join(" ");
    if (tokens.some((t) => CANCELW.has(t))) { setPending(null); return say("Theek hai, rehne diya."); }
    const again = (m) => say(m);
    if (p.kind === "customer") {
      let id = null;
      const o = ORD.findIndex((rx) => rx.test(j));
      if (o >= 0 && p.options[o]) id = p.options[o];
      if (!id) {
        const r = resolveCustomer(tokens.filter(isWord), d.customers.filter((x) => p.options.includes(x.id)));
        if (r.customer) id = r.customer.id;
      }
      if (!id) return again("Samajh nahi aaya. Pehla ya dusra bolein.");
      p.clauses[p.idx].customerId = id;
    } else if (p.kind === "name") {
      const nm = tokens.filter(isWord).slice(0, 2);
      if (!nm.length) return again("Naam samajh nahi aaya, phir bolein.");
      p.clauses[p.idx].name = nm;
    } else if (p.kind === "type") {
      const t = detectType(tokens);
      if (!t) return again("Udhaar ya payment? Bolein.");
      p.clauses[p.idx].type = t;
    }
    setPending(null);
    runClauses(p.clauses, p.idx, p.ctx, p.msgs);
  }

  function correctLast(tokens) {
    const d = dataRef.current;
    const last = d.entries[d.entries.length - 1];
    if (!last) return say("Sudhaarne ke liye koi entry nahi hai.");
    const nums = tokens.filter(isNum);
    const amount = nums.length ? Number(nums[0]) : last.amount;
    const type = detectType(tokens) || last.type;
    const r = resolveCustomer(tokens.filter(isWord).slice(0, 2), d.customers);
    const cust = r.customer || d.customers.find((x) => x.id === last.customerId);
    const fixed = { ...last, amount, type, customerId: cust.id, customerName: cust.name };
    commit({ ...d, entries: [...d.entries.slice(0, -1), fixed] });
    say(`Theek hai, pichli entry sudhaar di: ${cust.name}, ${amount} rupaye ${type === "credit" ? "udhaar" : "payment"}.`);
  }

  function undoLast() {
    const d = dataRef.current;
    const last = d.entries[d.entries.length - 1];
    if (!last) return say("Hatane ke liye koi entry nahi hai.");
    commit({ ...d, entries: d.entries.slice(0, -1) });
    say(`${last.customerName} ki ${last.amount} rupaye ki entry hata di.`);
  }

  function answerQuery(tokens) {
    const d = dataRef.current;
    const j = tokens.join(" ");
    const names = tokens.filter(isWord).slice(0, 2);

    if (/\ba+j\b/.test(j) && /kit|total|kul/.test(j)) {
      const pay = /jama|payment|mila|wapas|vapas|aaya|aaye/.test(j);
      const sum = d.entries.filter((e) => e.date === dateStr() && e.type === (pay ? "payment" : "credit")).reduce((s, e) => s + e.amount, 0);
      return say(pay ? `Aaj ${sum} rupaye payment aaya.` : `Aaj ${sum} rupaye udhaar gaya.`);
    }
    if (names.length) {
      const r = resolveCustomer(names, d.customers);
      const list = r.customer ? [r.customer] : r.ambiguous ? d.customers.filter((x) => r.options.includes(x.id)) : [];
      if (!list.length) return say(`${titleCase(names.join(" "))} naam ka koi customer nahi mila.`);
      return say(
        list.map((c) => {
          const b = balanceOf(d.entries, c.id);
          const n = labelOf(c, d.customers);
          return b >= 0 ? `${n} ka kul baaki ${b} rupaye hai.` : `${n} ke ${-b} rupaye zyada jama hain.`;
        }).join(" ")
      );
    }
    if (/sab|kis|kaun|list|total|kul|kit/.test(j) || tokens.length) {
      const owing = d.customers.map((c) => ({ c, b: balanceOf(d.entries, c.id) })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b);
      if (!owing.length) return say("Abhi kisi ka baaki nahi hai.");
      const total = owing.reduce((s, x) => s + x.b, 0);
      return say(`Kul baaki ${total} rupaye. ` + owing.slice(0, 3).map((x) => `${labelOf(x.c, d.customers)} ${x.b}`).join(", ") + ".");
    }
    say("Samajh nahi aaya. Aise bolein: Ramesh ka 340 udhaar.");
  }

  /* ----- UI actions ----- */
  const addCustomer = (e) => {
    e.preventDefault();
    const n = titleCase(newName.trim());
    if (!n) return;
    commit({ ...data, customers: [...data.customers, { id: uid(), name: n, optIn: false }] });
    setNewName("");
  };
  const toggleOpt = (id) => commit({ ...data, customers: data.customers.map((c) => (c.id === id ? { ...c, optIn: !c.optIn } : c)) });
  const delEntry = (id) => commit({ ...data, entries: data.entries.filter((e) => e.id !== id) });
  const resetAll = () => { if (confirm("Saara data hata kar demo data wapas laayein?")) { commit(STARTER); setPending(null); } };
  const copyReminder = (c, bal) => {
    const t = `Namaste ${c.name} ji, dukaan me aapka ${rupee(bal)} ka hisaab baaki hai. Jab suvidha ho tab de dijiyega. Dhanyavaad.`;
    navigator.clipboard && navigator.clipboard.writeText(t);
    setReply("Reminder text copy ho gaya: " + t);
  };

  const rows = useMemo(
    () => data.customers.map((c) => ({ c, bal: balanceOf(data.entries, c.id) })).sort((a, b) => b.bal - a.bal),
    [data]
  );
  const totalOwed = rows.reduce((s, r) => s + Math.max(r.bal, 0), 0);
  const todayCredit = data.entries.filter((e) => e.date === dateStr() && e.type === "credit").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="vk">
      <style>{CSS}</style>

      <header className="vk-head">
        <div>
          <h1>Voice Khata</h1>
          <p>Kirana udhaar ka hisaab, bas bolkar</p>
        </div>
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Bolne ki bhasha">
          <option value="hi-IN">Hindi / Hinglish</option>
          <option value="en-IN">English (India)</option>
        </select>
      </header>

      <p className="vk-ai">Ye ek AI voice sahayak hai. Aapka khata sirf is device ke browser me save hota hai.</p>

      <section className="vk-talk">
        <button className={"vk-mic" + (listening ? " on" : "")} onClick={toggleMic} aria-label="Mic">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <div className="vk-talk-text">
          <div className="vk-status">{status}</div>
          {transcript && <div className="vk-heard">Suna: {transcript}</div>}
          {reply && <div className="vk-reply">{reply}</div>}
        </div>
      </section>

      {pending && (
        <section className="vk-ask">
          <strong>Jawab chahiye</strong>
          {pending.kind === "customer" && (
            <div className="vk-opts">
              {pending.options.map((id) => {
                const c = data.customers.find((x) => x.id === id);
                return (
                  <button key={id} onClick={() => { pending.clauses[pending.idx].customerId = id; const p = pending; setPending(null); runClauses(p.clauses, p.idx, p.ctx, p.msgs); }}>
                    {labelOf(c, data.customers)}
                  </button>
                );
              })}
            </div>
          )}
          {pending.kind === "type" && (
            <div className="vk-opts">
              <button onClick={() => { pending.clauses[pending.idx].type = "credit"; const p = pending; setPending(null); runClauses(p.clauses, p.idx, p.ctx, p.msgs); }}>Udhaar</button>
              <button onClick={() => { pending.clauses[pending.idx].type = "payment"; const p = pending; setPending(null); runClauses(p.clauses, p.idx, p.ctx, p.msgs); }}>Payment</button>
            </div>
          )}
          <button className="vk-link" onClick={() => setPending(null)}>Rehne do</button>
        </section>
      )}

      <form className="vk-type" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { setTranscript(typed); handle(typed); setTyped(""); } }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ya yahan type karein: Suresh ka 250 udhaar" />
        <button type="submit">Bhejein</button>
      </form>

      <section className="vk-stats">
        <div><span>Kul baaki</span><b>{rupee(totalOwed)}</b></div>
        <div><span>Aaj ka udhaar</span><b>{rupee(todayCredit)}</b></div>
        <div><span>Customers</span><b>{data.customers.length}</b></div>
      </section>

      <section className="vk-card">
        <h2>Kisko kitna dena hai</h2>
        <ul className="vk-list">
          {rows.map(({ c, bal }) => (
            <li key={c.id}>
              <div>
                <b>{labelOf(c, data.customers)}</b>
                <label className="vk-opt"><input type="checkbox" checked={!!c.optIn} onChange={() => toggleOpt(c.id)} /> Reminder ke liye sahmat</label>
              </div>
              <div className="vk-bal">
                <span className={bal > 0 ? "owe" : "ok"}>{bal > 0 ? rupee(bal) + " baaki" : bal < 0 ? rupee(-bal) + " zyada jama" : "Hisaab saaf"}</span>
                {c.optIn && bal > 0 && <button className="vk-link" onClick={() => copyReminder(c, bal)}>Reminder copy</button>}
              </div>
            </li>
          ))}
        </ul>
        <form className="vk-add" onSubmit={addCustomer}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Naya customer (jaise: Ramesh Gupta)" />
          <button type="submit">Jodein</button>
        </form>
      </section>

      <section className="vk-card">
        <h2>Haal ki entries</h2>
        {data.entries.length === 0 ? (
          <p className="vk-empty">Abhi koi entry nahi. Mic dabakar pehli entry bolein.</p>
        ) : (
          <div className="vk-wrap">
            <table>
              <thead><tr><th>Tareekh</th><th>Customer</th><th>Kism</th><th>Rakam</th><th></th></tr></thead>
              <tbody>
                {[...data.entries].reverse().slice(0, 30).map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.customerName}</td>
                    <td className={e.type === "credit" ? "owe" : "ok"}>{e.type === "credit" ? "Udhaar" : "Payment"}</td>
                    <td>{rupee(e.amount)}</td>
                    <td><button className="vk-link" onClick={() => delEntry(e.id)}>Hatao</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="vk-foot">
        <span>Bolkar try karein: "Ramesh ka 340 udhaar, kal 200 diya tha" · "nahi, 430" · "Aaj kitna udhaar gaya?"</span>
        <button className="vk-link" onClick={resetAll}>Demo data wapas laayein</button>
      </footer>
    </div>
  );
}

const CSS = `
.vk{--ink:#16243f;--paper:#f2f5f9;--card:#fff;--line:#d5dde8;--mute:#5b6980;--owe:#b3261e;--ok:#1d7a4d;--hot:#e8a317;
  max-width:760px;margin:0 auto;padding:20px 16px 40px;color:var(--ink);background:var(--paper);min-height:100vh;
  font-family:"Segoe UI",system-ui,sans-serif;line-height:1.45;box-sizing:border-box;text-align:left}
.vk *{box-sizing:border-box}
.vk h1{margin:0;font-size:1.9rem;letter-spacing:-.02em}
.vk h2{margin:0 0 12px;font-size:1.1rem}
.vk p{margin:0}
.vk-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.vk-head p{color:var(--mute)}
.vk select,.vk input{border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:inherit;background:#fff;color:var(--ink)}
.vk button{font:inherit;cursor:pointer;border:0;border-radius:8px;padding:9px 14px;background:var(--ink);color:#fff}
.vk button:focus-visible,.vk input:focus-visible,.vk select:focus-visible{outline:3px solid var(--hot);outline-offset:2px}
.vk-link{background:none!important;color:var(--ink)!important;text-decoration:underline;padding:4px!important}
.vk-ai{margin:14px 0;padding:9px 12px;border-left:4px solid var(--hot);background:#fff;font-size:.92rem;color:var(--mute)}
.vk-talk{display:flex;gap:18px;align-items:center;background:var(--ink);color:#fff;border-radius:16px;padding:20px}
.vk .vk-mic{flex:none;width:104px;height:104px;border-radius:50%;padding:0;display:grid;place-items:center;background:var(--hot);color:var(--ink);transition:transform .15s}
.vk .vk-mic.on{background:#e5484d;color:#fff;animation:vkp 1s infinite}
@keyframes vkp{50%{transform:scale(1.07)}}
@media (prefers-reduced-motion:reduce){.vk .vk-mic.on{animation:none}}
.vk-talk-text{min-width:0;display:grid;gap:6px}
.vk-status{font-weight:600}
.vk-heard{opacity:.8;font-size:.92rem;overflow-wrap:anywhere}
.vk-reply{background:rgba(255,255,255,.12);border-radius:8px;padding:8px 10px;overflow-wrap:anywhere}
.vk-ask{margin-top:12px;padding:12px;border:2px solid var(--hot);border-radius:12px;background:#fff;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.vk-opts{display:flex;gap:8px;flex-wrap:wrap}
.vk-type,.vk-add{display:flex;gap:8px;margin-top:12px}
.vk-type input,.vk-add input{flex:1;min-width:0}
.vk-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
.vk-stats div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:grid}
.vk-stats span{color:var(--mute);font-size:.85rem}
.vk-stats b{font-size:1.25rem}
.vk-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:14px}
.vk-list{list-style:none;margin:0;padding:0}
.vk-list li{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
.vk-list li:last-child{border-bottom:0}
.vk-opt{display:block;font-size:.8rem;color:var(--mute)}
.vk-opt input{margin-right:6px}
.vk-bal{text-align:right;display:grid;justify-items:end}
.owe{color:var(--owe);font-weight:600}.ok{color:var(--ok);font-weight:600}
.vk-wrap{overflow-x:auto}
.vk table{width:100%;border-collapse:collapse;font-size:.92rem}
.vk th,.vk td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
.vk-empty{color:var(--mute)}
.vk-foot{margin-top:18px;display:flex;flex-direction:column;gap:8px;font-size:.85rem;color:var(--mute);align-items:flex-start}
@media (max-width:520px){.vk-talk{flex-direction:column;text-align:center}.vk-stats b{font-size:1rem}}
`;
