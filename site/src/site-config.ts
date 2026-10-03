import type { SiteConfig } from '@mcptoolshop/site-theme';

export const config: SiteConfig = {
  title: 'LoKey Typer',
  description:
    'A calm typing practice app with ambient soundscapes, personalized daily sets, and no accounts required.',
  logoBadge: 'LK',
  brandName: 'LoKey Typer',
  repoUrl: 'https://github.com/mcp-tool-shop-org/lokey-typer',
  footerText:
    'MIT Licensed — built by <a href="https://mcp-tool-shop.github.io/" style="color:var(--color-muted);text-decoration:underline">mcp-tool-shop-org</a>',

  hero: {
    badge: 'v1.0 — Microsoft Store + PWA',
    headline: 'Typing practice that',
    headlineAccent: 'stays out of the way.',
    description:
      'Ambient soundscapes, personalized daily sets, full offline support. No accounts, no cloud, no tracking.',
    primaryCta: { href: '#quick-start', label: 'Get started' },
    secondaryCta: { href: 'handbook/', label: 'Read the Handbook' },
    previews: [
      {
        title: 'Microsoft Store',
        language: 'text',
        code: 'https://apps.microsoft.com/detail/9NRVWM08HQC4',
      },
      {
        title: 'Browser PWA',
        language: 'text',
        code: 'https://mcp-tool-shop-org.github.io/lokey-typer/',
      },
      {
        title: 'Dev server',
        language: 'bash',
        code: 'npm ci\nnpm run dev',
      },
    ],
  },

  sections: [
    {
      id: 'features',
      title: 'Features',
      subtitle: 'Built for adults who want quiet, focused typing sessions.',
      kind: 'features',
      features: [
        {
          icon: '🎧',
          title: 'Ambient Soundscapes',
          description:
            '42 non-rhythmic tracks designed for sustained focus. No beats, no loops, no distraction.',
        },
        {
          icon: '📅',
          title: 'Personalized Daily Sets',
          description:
            'A fresh set of exercises each day, adapted to your recent sessions. All local, no cloud.',
        },
        {
          icon: '📴',
          title: 'Fully Offline',
          description:
            'Works offline after first load. PWA + Microsoft Store. No accounts, no telemetry.',
        },
        {
          icon: '⌨️',
          title: 'Typewriter Keystrokes',
          description:
            'Optional mechanical typewriter audio feedback. Mixed to never compete with ambient sound.',
        },
        {
          icon: '♿',
          title: 'Accessible by Default',
          description:
            'Screen reader mode, reduced motion, sound-optional. If sound makes it harder, that is a bug.',
        },
        {
          icon: '🔒',
          title: 'Privacy First',
          description:
            'All data stays in your browser. Zero network calls at runtime. No analytics, no tracking.',
        },
      ],
    },
    {
      id: 'modes',
      title: 'Practice Modes',
      subtitle: 'Four ways to practice, each designed for a different mindset.',
      kind: 'data-table',
      columns: ['Mode', 'Description'],
      rows: [
        ['Focus', 'Calm, curated exercises for building rhythm and accuracy.'],
        [
          'Real-Life',
          'Practice with emails, code snippets, and everyday text.',
        ],
        ['Competitive', 'Timed sprints with personal bests.'],
        [
          'Daily Set',
          'A fresh set generated each day, adapted to your recent sessions.',
        ],
      ],
    },
    {
      id: 'quick-start',
      title: 'Quick Start',
      subtitle: 'Up and running in under a minute.',
      kind: 'code-cards',
      cards: [
        {
          title: 'Microsoft Store (recommended)',
          language: 'text',
          code: 'Search "LoKey Typer" in the Microsoft Store\nor visit:\nhttps://apps.microsoft.com/detail/9NRVWM08HQC4',
        },
        {
          title: 'Browser PWA',
          language: 'text',
          code: '1. Visit the web app in Edge or Chrome\n2. Click the install icon in the address bar\n3. Done — works offline from here',
        },
        {
          title: 'Run locally (dev)',
          language: 'bash',
          code: 'git clone https://github.com/mcp-tool-shop-org/lokey-typer.git\ncd lokey-typer\nnpm ci\nnpm run dev',
        },
      ],
    },
    {
      id: 'sound-design',
      title: 'Sound Design',
      subtitle:
        'An acoustic environment, not a playlist. Designed for focus, not stimulation.',
      kind: 'features',
      features: [
        {
          icon: '🌊',
          title: 'Non-Rhythmic',
          description:
            'No tempo, no beat, no pulse. The soundscape avoids rhythmic entrainment entirely.',
        },
        {
          icon: '🔇',
          title: 'Keystroke-Safe Mixing',
          description:
            'Ambient is mixed to never mask typing sounds and never reacts to typing rhythm.',
        },
        {
          icon: '🕐',
          title: 'Long-Session Safe',
          description:
            'Volume levels stay low and stable. Frequency ranges associated with fatigue are avoided.',
        },
        {
          icon: '🔄',
          title: 'Subtle Evolution',
          description:
            'The environment evolves gradually over time. If you forget it is there, it is doing its job.',
        },
      ],
    },
    {
      id: 'privacy',
      title: 'Privacy & Security',
      subtitle: 'Your data never leaves your device.',
      kind: 'data-table',
      columns: ['Aspect', 'Detail'],
      rows: [
        ['Data stored', 'Browser localStorage only (preferences, run history, personal bests)'],
        ['Cloud sync', 'None'],
        ['Telemetry', 'None'],
        ['Analytics', 'None'],
        ['Accounts', 'None required or supported'],
        ['Network at runtime', 'Zero calls after initial load + service worker cache'],
      ],
    },
  ],
};
