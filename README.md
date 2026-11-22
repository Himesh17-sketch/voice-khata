# Voice Khata – Kirana Store Voice Ledger

A beginner-friendly React + Vite prototype for a Hindi/Hinglish voice-based kirana ledger.

## Features
- Voice input using browser Web Speech API (`hi-IN`)
- Credit and payment entries
- Spoken balance and daily summary
- Confirmation before saving voice entries
- Basic spoken amount correction ("nahi, 430")
- Customer search and manual entry
- Local browser storage (localStorage)
- Responsive dashboard

## Requirements
- Node.js LTS
- VS Code
- Google Chrome recommended for Web Speech API support

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite, usually `http://localhost:5173`.

## Production build
```bash
npm run build
npm run preview
```

## Example voice commands
- `Ramesh ka 340 udhaar`
- `Suresh ne 200 diye`
- `Ramesh ka total kitna`
- `Aaj kitna udhaar gaya`

## Architecture
```text
Shopkeeper voice
      |
      v
Browser Speech Recognition (hi-IN)
      |
      v
Command parser (customer / amount / intent)
      |
      v
Confirmation screen
      |
      v
Ledger logic (credit / payment / balance)
      |
      v
localStorage  --->  Dashboard / Spoken response
```

## Important prototype limitations
- Browser speech recognition support and accuracy depend on browser, microphone, language settings, network and background noise.
- The current number parser supports common Hindi number words and numeric digits; it is not a complete multilingual or noise-robust streaming speech model.
- Data is stored in this browser profile only. It is not encrypted, synced or backed up. Do not use real customer financial data in this demo.
- This prototype is not a production accounting system. Add authentication, encrypted storage, backups, audit logs and stronger validation before real deployment.

## Privacy
Demo entries are stored in this browser's localStorage. Use synthetic test data only.
