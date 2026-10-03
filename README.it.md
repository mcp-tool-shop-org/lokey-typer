<p align="center">
  <strong>English</strong> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português</a>
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

Un'applicazione per esercitarsi nella digitazione, caratterizzata da un'interfaccia rilassante, paesaggi sonori ambientali, impostazioni giornaliere personalizzabili e che non richiede la creazione di un account.

## Cos'è

LoKey Typer è un'applicazione per esercitarsi nella dattilografia, progettata per adulti che desiderano sessioni di lavoro tranquille e concentrate, senza elementi di gamification, classifiche o distrazioni.

Tutti i dati rimangono sul tuo dispositivo. Nessun account. Nessun servizio cloud. Nessun tracciamento.

## Modalità di allenamento

- **Focus:** Esercizi mirati e ben strutturati per migliorare il ritmo e la precisione.
- **Vita reale:** Pratica con email, frammenti di codice e testi di uso quotidiano.
- **Competitivo:** Sessioni a tempo con il monitoraggio dei risultati personali.
- **Set giornaliero:** Un nuovo insieme di esercizi generato ogni giorno, adattato alle vostre sessioni precedenti.

## Caratteristiche

- Paesaggi sonori ambient progettati per favorire la concentrazione prolungata (42 tracce, non ritmiche).
- Suoni di battitura di una macchina da scrivere (opzionale).
- Esercizi giornalieri personalizzati in base alle sessioni precedenti.
- Funzionalità completa offline dopo il primo caricamento.
- Accessibilità: modalità lettore di schermo, riduzione delle animazioni, possibilità di disattivare l'audio.

## Installa

**Microsoft Store** (consigliato):
[Scaricalo dal Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Browser:**
Eseguite `npm run dev` e aprite l'indirizzo locale. Il workflow di Pages pubblica l'app su [la destinazione Pages](https://mcp-tool-shop-org.github.io/lokey-typer/) quando questo repository è pubblico. Il manuale è servito sotto `/handbook/` sullo stesso sito. Fino ad allora, quell'indirizzo non è un'app attiva.

## Privacy

LoKey Typer non raccoglie alcun dato. Tutte le preferenze, la cronologia delle sessioni e i risultati personali vengono memorizzati localmente nel vostro browser. Consultare la [politica sulla privacy](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html) completa. Quella pagina viene pubblicata con il sito. Finché questo repository non è pubblico, quell'indirizzo non è attivo.

## Licenza

MIT. Consultare [LICENZA](LICENSE).

---

## Sviluppo

### Eseguire localmente

```bash
npm ci
npm run dev
```

### Costruire

```bash
npm run build
npm run preview
```

### Script.
Copioni.
Sceneggiature.
Programmi.
Codici

- `npm run dev`: server di sviluppo
- `npm run build`: controllo dei tipi + compilazione per la produzione
- `npm run typecheck`: controllo dei tipi (solo compilazione TypeScript)
- `npm run lint`: ESLint
- `npm run preview`: anteprima della compilazione per la produzione, eseguita localmente
- `npm run validate:content`: controllo dello schema e della struttura per tutti i pacchetti di contenuti
- `npm run gen:phase2-content`: rigenerazione dei pacchetti della Fase 2
- `npm run smoke:rotation`: test di verifica della novità/rotazione
- `npm run qa:ambient:assets`: controlli degli asset audio ambientali (formato WAV)
- `npm run qa:sound-design`: controlli di accettazione del design sonoro
- `npm run qa:phase3:novelty`: simulazione giornaliera di nuovi contenuti
- `npm run qa:phase3:recommendation`: simulazione di verifica delle raccomandazioni

### Struttura del codice

- `src/app`: configurazione dell'applicazione (router, struttura/layout, provider globali).
- `src/features`: interfaccia utente specifica per ogni funzionalità (pagine e componenti delle funzionalità).
- `src/lib`: logica di dominio condivisa (archiviazione, metriche, audio/ambiente, ecc.).
- `src/content`: tipi di contenuto e caricamento dei pacchetti di contenuti.

Consultare il file `modular.md` per informazioni sulle specifiche architetturali e sui limiti di importazione.

### Alias per importazioni

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (interfaccia API pubblica)
- `@lib-internal` → `src/lib` (riservata all'integrazione e ai provider dell'applicazione)

### Percorsi

- `/` — Home (Pagina principale)
- `/daily` — Programma giornaliero
- `/focus` — Modalità "Focus"
- `/real-life` — Modalità "Vita reale"
- `/competitive` — Modalità "Competitiva"
- `/<mode>/exercises` — Elenco degli esercizi
- `/<mode>/settings` — Impostazioni
- `/<mode>/run/:exerciseId` — Esegui un esercizio

### Documenti

- `modular.md` — architettura e definizione dei confini per l'importazione di moduli.
- `docs/sound-design.md` — framework per la progettazione del suono ambientale.
- `docs/sound-design-manifesto.md` — manifesto sulla progettazione del suono e test di accettazione.
- `docs/sound-philosophy.md` — filosofia del suono, pensata per il pubblico.
- `docs/accessibility-commitment.md` — impegno per l'accessibilità.
- `docs/how-personalization-works.md` — spiegazione del funzionamento della personalizzazione.
