// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://mcp-tool-shop-org.github.io',
  base: '/lokey-typer/handbook',
  integrations: [
    starlight({
      title: 'LoKey Typer',
      description: 'LoKey Typer handbook',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mcp-tool-shop-org/lokey-typer' },
      ],
      sidebar: [
        {
          label: 'Handbook',
          autogenerate: { directory: '.' },
        },
      ],
      customCss: ['./src/styles/starlight-custom.css'],
      disable404Route: true,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
