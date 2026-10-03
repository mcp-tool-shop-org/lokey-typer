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

Um aplicativo para praticar digitação, com um design tranquilo, paisagens sonoras relaxantes, conjuntos diários personalizados e que não exige a criação de contas.

## O que é isso

LoKey Typer é um aplicativo para praticar digitação, desenvolvido para adultos que desejam sessões de estudo silenciosas e focadas, sem elementos de gamificação, rankings ou distrações.

Todos os dados permanecem no seu dispositivo. Não são necessários contas. Não há armazenamento em nuvem. Não há rastreamento.

## Modos de treino

- **Foco** — Exercícios cuidadosamente elaborados para desenvolver ritmo e precisão.
- **Realidade** — Prática com e-mails, formulários, mensagens, notas e outros textos do dia a dia.
- **Competitivo** — Desafios cronometrados com seus melhores resultados pessoais.
- **Conjunto Diário** — Um novo conjunto de exercícios gerado diariamente, adaptado às suas sessões recentes.

## Características

- Paisagens sonoras ambientais projetadas para promover a concentração. As configurações listam apenas as categorias que têm uma faixa.
- Sons de máquina de escrever (opcional).
- Exercícios diários personalizados com base nas sessões recentes.
- Suporte completo offline após o primeiro carregamento.
- Acessível: modo de leitor de tela, redução de movimento, opção de desativar o som.

## Instalar

**Microsoft Store** (recomendado):
[Obtenha-o na Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Navegador:**
Execute `npm run dev` e abra o endereço local. O fluxo do Pages publica o aplicativo em [o destino do Pages](https://mcp-tool-shop-org.github.io/lokey-typer/) quando este repositório for público. O manual fica em `/handbook/` nesse mesmo site. Até lá, esse endereço não é um aplicativo no ar.

## Privacidade

O LoKey Typer não coleta nenhum dado. Todas as preferências, histórico de uso e melhores resultados são armazenados localmente no seu navegador. Consulte a [política de privacidade](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html) completa. Essa página é publicada com o site. Até este repositório ser público, esse endereço não está no ar.

## Licença

MIT. Consulte [LICENSE](LICENSE).

---

## Desenvolvimento

### Executar localmente

```bash
npm ci
npm run dev
```

### Construir

```bash
npm run build
npm run preview
```

### Roteiros

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — verificação de tipos + compilação para produção
- `npm run typecheck` — verificação de tipos exclusiva para o TypeScript
- `npm run lint` — ESLint
- `npm run preview` — visualização local da compilação para produção
- `npm run validate:content` — validação de esquema e estrutura para todos os pacotes de conteúdo
- `npm run gen:phase2-content` — regeneração dos pacotes da Fase 2
- `npm run smoke:rotation` — teste de funcionalidade para novidades/rotação
- `npm run qa:ambient:assets` — verificação de arquivos WAV de áudio ambiente
- `npm run qa:sound-design` — testes de aceitação para o design de som
- `npm run qa:phase3:novelty` — simulação diária de novidades
- `npm run qa:phase3:recommendation` — simulação de sanidade para recomendações

### Estrutura do código

- `src/app` — estrutura da aplicação (roteamento, layout/interface, provedores globais).
- `src/features` — interface do usuário específica de cada funcionalidade (páginas + componentes da funcionalidade).
- `src/lib` — lógica de domínio compartilhada (armazenamento, métricas, áudio/ambiente, etc.).
- `src/content` — tipos de conteúdo + carregamento de pacotes de conteúdo.

Consulte o arquivo `modular.md` para obter informações sobre os contratos de arquitetura e os limites de importação.

### Apelidos de importação

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (interface pública da biblioteca)
- `@lib-internal` → `src/lib` (restrito à configuração e provedores da aplicação)

### Rotas

- `/` — Página inicial
- `/daily` — Conjunto diário
- `/focus` — Modo de foco
- `/real-life` — Modo "vida real"
- `/competitive` — Modo competitivo
- `/focus/run/:exerciseId`, `/real-life/run/:exerciseId`, `/competitive/run/:exerciseId` — Executar um exercício
- `/practice` redireciona para `/focus`. `/arcade` redireciona para `/competitive`

As configurações abrem no cabeçalho. Não há uma página de lista de exercícios.

### Documentos

- `modular.md` — arquitetura + contratos de interface de importação.
- `docs/sound-design.md` — estrutura para design de som ambiente.
- `docs/sound-design-manifesto.md` — manifesto do design de som + testes de aceitação.
- `docs/sound-philosophy.md` — princípios filosóficos do som, voltados para o público.
- `docs/accessibility-commitment.md` — compromisso com a acessibilidade.
- `docs/how-personalization-works.md` — explicação sobre como a personalização funciona.
