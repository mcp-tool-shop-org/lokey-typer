<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
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

Um aplicativo de prática de digitação calmo, com paisagens sonoras ambiente, conjuntos diários personalizados e sem necessidade de contas.

## O que é

LoKey Typer é um aplicativo de prática de digitação desenvolvido para adultos que desejam sessões tranquilas e focadas, sem gamificação, tabelas de classificação ou distrações.

Todos os dados permanecem no seu dispositivo. Sem contas. Sem nuvem. Sem rastreamento.

## Modos de prática

- **Foco** — Exercícios calmos e selecionados para desenvolver ritmo e precisão
- **Vida Real** — Pratique com e-mails, formulários, mensagens, notas e outros textos do dia a dia
- **Competitivo** — Séries cronometradas com melhores tempos pessoais
- **Conjunto Diário** — Um novo conjunto de exercícios gerado a cada dia, adaptado às suas sessões recentes
- **Estudo** — Adicione seu próprio texto. Ele permanece neste dispositivo e é apresentado aos poucos, em ordem ou aleatoriamente.

## Recursos

- Paisagens sonoras ambiente projetadas para manter o foco. As configurações listam apenas as categorias que possuem uma faixa sonora.
- Áudio de digitação de máquina de escrever mecânica (opcional), além de sons de clique, som suave e silenciado. O teclado que você escolher será usado nessa gravação. O padrão é o teclado mecânico.
- Exercícios diários personalizados com base nas sessões recentes
- Suporte completo offline após o primeiro carregamento
- Acessível: modo de leitor de tela, movimento reduzido, som opcional

## Instalação

**Microsoft Store** (recomendado):
[Obtenha-o na Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Navegador:**
Execute `npm run dev` e abra o endereço local. O fluxo de trabalho do Pages publica o aplicativo em [o site do Pages](https://mcp-tool-shop-org.github.io/lokey-typer/). O manual está disponível em `/handbook/` no mesmo site.

## Privacidade

LoKey Typer não coleta dados. As preferências, o histórico de uso, os melhores tempos pessoais e o texto que você adiciona para o Estudo permanecem neste navegador. Consulte a [política de privacidade](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html) completa. Essa página é enviada com o site.

## Licença

MIT. Consulte [LICENSE](LICENSE).

---

## Desenvolvimento

### Executar localmente

```bash
npm ci
npm run dev
```

### Compilar

```bash
npm run build
npm run preview
```

### Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — verificação de tipo + compilação para produção
- `npm run verify` — verificação de conteúdo, validação de sons, verificação de tipo, cobertura e compilação para produção
- `npm run typecheck` — compilação do TypeScript, apenas verificação de tipo
- `npm run lint` — ESLint
- `npm run preview` — visualização da compilação para produção localmente
- `npm run validate:content` — validação de esquema e estrutura para todos os pacotes de conteúdo
- `npm run gen:phase2-content` — regenerar pacotes da Fase 2
- `npm run smoke:rotation` — teste de novidade/rotação
- `npm run qa:ambient:assets` — verificação de ativos WAV ambiente
- `npm run qa:sound-design` — validação do design de som
- `npm run qa:phase3:novelty` — simulação de novidade do conjunto diário
- `npm run qa:phase3:recommendation` — simulação de sanidade da recomendação

### Estrutura do código

- `src/app` — configuração do aplicativo (roteador, shell/layout, provedores globais)
- `src/features` — interface do usuário específica do recurso (páginas + componentes de recurso)
- `src/lib` — lógica de domínio compartilhada (armazenamento, métricas de digitação, áudio/ambiente, etc.)
- `src/content` — tipos de conteúdo + carregamento de pacotes de conteúdo

Consulte `modular.md` para contratos de arquitetura e limites de importação.

### Aliases de importação

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (superfície da API pública)
- `@lib-internal` → `src/lib` (restrito à configuração/provedores do aplicativo)

### Rotas

- `/` — Página inicial
- `/daily` — Conjunto Diário
- `/focus` — Modo Foco
- `/real-life` — Modo Vida Real
- `/competitive` — Modo Competitivo
- `/study` — Estudo, para o texto que você adiciona
- `/focus/run/:exerciseId`, `/real-life/run/:exerciseId`, `/competitive/run/:exerciseId` — executar um exercício
- `/practice` redireciona para `/focus`. `/arcade` redireciona para `/competitive`

As configurações são abertas a partir do cabeçalho. Não há uma página de lista de exercícios.

### Documentação

- `modular.md` — arquitetura + contratos de limite de importação
- `docs/sound-design.md` — estrutura de design de som ambiente
- `docs/sound-design-manifesto.md` — manifesto de design de som + testes de aceitação
- `docs/sound-philosophy.md` — filosofia de som voltada para o público
- `docs/accessibility-commitment.md` — compromisso com a acessibilidade
- `docs/how-personalization-works.md` — explicação da personalização

---

## Segurança e Escopo de Dados

LoKey Typer é um aplicativo web de prática de digitação (PWA + Microsoft Store) sem contas e sem telemetria.

- **Dados acessados:** localStorage do navegador (preferências, histórico de uso, melhores tempos pessoais) e o banco de dados IndexedDB `lokey-study` (texto que você adiciona na página de Estudo)
- **Dados NÃO acessados:** Sem sincronização na nuvem. Sem telemetria. Sem análise. Sem contas. Sem rastreamento
- **Rede:** O aplicativo carrega suas próprias páginas e áudio do mesmo domínio. Ele não chama um serviço de conta, um ponto de extremidade de telemetria ou qualquer API de terceiros.
- **Nenhuma telemetria** é coletada ou enviada

Política completa: [SECURITY.md](SECURITY.md)

---

## Avaliação

| Categoria | Pontuação |
|----------|-------|
| A. Segurança | 10/10 |
| B. Tratamento de Erros | 10/10 |
| C. Documentação para Operadores | 10/10 |
| D. Higiene de Lançamento | 10/10 |
| E. Identidade (suave) | 10/10 |
| **Overall** | **50/50** |

---

<p align="center">
  Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
</p>
