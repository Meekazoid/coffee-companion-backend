# Rebranding Rollout Order (BrewBuddy → Dripmate)

Diese Reihenfolge minimiert Ausfälle durch CORS/Domain-Mismatch.

## Empfohlene Reihenfolge

1. **Frontend- und Backend-PRs zuerst mergen**
   - Damit Code, Doku und Konfigurationsdefaults bereits auf `dripmate` vorbereitet sind.

2. **Backend zuerst deployen (kompatibel)**
   - `ALLOWED_ORIGINS` temporär so setzen, dass **alt + neu** erlaubt sind (falls möglich), z. B.:
     - `https://brewbuddy-sixty.vercel.app`
     - `https://dripmate.vercel.app`
   - Dadurch funktioniert das bestehende Frontend weiter, während das neue live geht.

3. **Frontend deployen / Domain auf `dripmate.vercel.app` umstellen**
   - Danach sollten Requests gegen das bereits kompatible Backend laufen.

4. **Dienste umbenennen (Railway/Vercel/GitHub) und finalisieren**
   - Railway Service auf `dripmate-backend` umbenennen
   - Railway Env `ALLOWED_ORIGINS` auf finalen Wert reduzieren (nur neue Domain, falls gewünscht)
   - Vercel-Projekt-/Domain-Setup finalisieren

5. **Finaler Smoke-Test**
   - Healthcheck, Login/Auth, kritische API-Flows prüfen

## Kurzantwort auf die Frage

> Zuerst Dienste umbenennen oder zuerst Frontend/Backend-PR?

**Zuerst Frontend- und Backend-PR (inkl. Deploy), dann Dienste/Projektnamen final umbenennen.**

Wenn ihr ohne Übergangsphase arbeitet (kein duales CORS), steigt das Risiko für kurzfristige CORS-Fehler.
