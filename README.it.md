<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/LoKey-Typer/readme.png" alt="LoKey Typer" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml"><img src="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/lokey-typer/"><img src="https://img.shields.io/badge/Pages-target-blue" alt="Pages target"></a>
  <a href="https://apps.microsoft.com/detail/9NRVWM08HQC4"><img src="https://img.shields.io/badge/Microsoft_Store-available-blue" alt="Microsoft Store"></a>
</p>

Un'app per esercitarsi a scrivere in modo rilassante, con paesaggi sonori ambientali, esercizi giornalieri personalizzati e senza la necessità di creare un account.

## Cos'è

LoKey Typer è un'app per esercitarsi a scrivere, progettata per adulti che desiderano sessioni tranquille e concentrate, senza elementi di gamification, classifiche o distrazioni.

Tutti i dati rimangono sul tuo dispositivo. Nessun account. Nessun cloud. Nessun tracciamento.

## Modalità di esercizio

- **Focus:** esercizi mirati e rilassanti per sviluppare ritmo e precisione.
- **Real-Life:** esercitazione con e-mail, moduli, messaggi, note e altri testi di uso quotidiano.
- **Competitive:** sessioni a tempo con i propri migliori risultati personali.
- **Daily Set:** un nuovo set di esercizi generato ogni giorno, adattato alle sessioni precedenti.
- **Study:** aggiungi il tuo testo. Questo rimarrà su questo dispositivo e verrà riprodotto gradualmente, in ordine o in modo casuale.

## Funzionalità

- Paesaggi sonori ambientali progettati per favorire la concentrazione. Le impostazioni mostrano solo le categorie che hanno una traccia audio.
- Audio di battitura di macchina meccanica (opzionale), oltre a Clicky, Tick e Muted. La tastiera selezionata verrà utilizzata per la registrazione. La tastiera meccanica è l'impostazione predefinita.
- Esercizi giornalieri personalizzati basati sulle sessioni recenti.
- Supporto completo offline dopo il primo caricamento.
- Accessibilità: modalità per lettori di schermo, riduzione dei movimenti, audio opzionale.

## Installazione

**Microsoft Store** (consigliato):
[Scaricalo dal Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Browser:**
Esegui `npm run dev` e apri l'indirizzo locale. Il workflow di Pages pubblica l'app su [il sito di Pages](https://mcp-tool-shop-org.github.io/lokey-typer/). Il manuale è disponibile all'indirizzo `/handbook/` sullo stesso sito.

**Docker (hosting autonomo):**

```bash
docker run -d --name lokey-typer -p 8080:8080 --restart unless-stopped ghcr.io/mcp-tool-shop-org/lokey-typer:latest
```

Quindi, apri `http://localhost:8080/`. Il manuale è disponibile all'indirizzo `/lokey-typer/handbook/`. I tuoi progressi vengono salvati dal tuo browser per quell'indirizzo, non all'interno del container, quindi l'arresto, l'aggiornamento o la sostituzione del container li manterrà. Apri lo stesso host e la stessa porta ogni volta; un indirizzo diverso avvierà una nuova sessione.

## Privacy

LoKey Typer non raccoglie dati. Le preferenze, la cronologia delle sessioni, i migliori risultati personali e il testo che aggiungi per la modalità Study vengono salvati in questo browser. Consulta l'informativa sulla privacy completa [qui](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html). Questa pagina viene fornita con il sito.

## Licenza

MIT. Consulta [LICENSE](LICENSE).

---

## Sviluppo

### Esecuzione locale

```bash
npm ci
npm run dev
```

### Compilazione

```bash
npm run build
npm run preview
```

### Script

- `npm run dev` — server di sviluppo
- `npm run build` — controllo del tipo + compilazione per la produzione
- `npm run verify` — controlli del contenuto, controlli audio, controllo del tipo, copertura e compilazione per la produzione
- `npm run typecheck` — controllo del tipo di sola compilazione TypeScript
- `npm run lint` — ESLint
- `npm run preview` — anteprima della compilazione per la produzione in locale
- `npm run validate:content` — convalida dello schema e della struttura per tutti i pacchetti di contenuti
- `npm run gen:phase2-content` — rigenera i pacchetti di Fase 2
- `npm run smoke:rotation` — test di novità/rotazione
- `npm run qa:ambient:assets` — controlli delle risorse audio ambientali
- `npm run qa:sound-design` — controlli di accettazione del sound design
- `npm run qa:phase3:novelty` — simulazione di novità del set giornaliero
- `npm run qa:phase3:recommendation` — simulazione di sanità delle raccomandazioni

### Struttura del codice

- `src/app` — configurazione dell'app (router, shell/layout, provider globali)
- `src/features` — interfaccia utente specifica per ogni funzionalità (pagine + componenti delle funzionalità)
- `src/lib` — logica di dominio condivisa (archiviazione, metriche di digitazione, audio/ambiente, ecc.)
- `src/content` — tipi di contenuto + caricamento dei pacchetti di contenuti

Consulta `modular.md` per i contratti di architettura e i limiti di importazione.

### Alias di importazione

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (superficie API pubblica)
- `@lib-internal` → `src/lib` (limitato alla configurazione dell'app/provider)

### Route

- `/` — Home
- `/daily` — Daily Set
- `/focus` — Modalità Focus
- `/real-life` — Modalità Real-Life
- `/competitive` — Modalità Competitive
- `/study` — Study, per il testo che aggiungi
- `/focus/run/:exerciseId`, `/real-life/run/:exerciseId`, `/competitive/run/:exerciseId` — esegui un esercizio
- `/practice` reindirizza a `/focus`. `/arcade` reindirizza a `/competitive`

Le impostazioni si aprono dall'intestazione. Non esiste una pagina con l'elenco degli esercizi.

### Documentazione

- `modular.md` — architettura + contratti di limite di importazione
- `docs/sound-design.md` — framework di sound design ambientale
- `docs/sound-design-manifesto.md` — manifesto del sound design + test di accettazione
- `docs/sound-philosophy.md` — filosofia del suono rivolta al pubblico
- `docs/accessibility-commitment.md` — impegno per l'accessibilità
- `docs/how-personalization-works.md` — spiegazione della personalizzazione

---

## Sicurezza e ambito dei dati

LoKey Typer è un'app web per esercitarsi a scrivere (PWA + Microsoft Store) senza account e senza telemetria.

- **Dati a cui si accede:** localStorage del browser (preferenze, cronologia delle sessioni, migliori risultati personali) e il database IndexedDB `lokey-study` (testo che aggiungi nella pagina Study)
- **Dati a cui NON si accede:** Nessuna sincronizzazione cloud. Nessuna telemetria. Nessuna analisi. Nessun account. Nessun tracciamento
- **Rete:** l'app carica le proprie pagine e l'audio dalla stessa origine. Non chiama un servizio di account, un endpoint di telemetria o qualsiasi API di terze parti.
- **Non viene raccolta o inviata alcuna telemetria**

Informativa completa: [SECURITY.md](SECURITY.md)

---

## Valutazione

| Categoria | Punteggio |
|----------|-------|
| A. Sicurezza | 10/10 |
| B. Gestione degli errori | 10/10 |
| C. Documentazione per gli operatori | 10/10 |
| D. Igiene della pubblicazione | 10/10 |
| E. Identità (soft) | 10/10 |
| **Overall** | **50/50** |

---

<p align="center">
  Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
</p>
