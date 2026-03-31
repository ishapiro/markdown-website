import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['InterVariable', 'Inter', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Cascadia Mono', 'Roboto Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        // Obsidian Publish light theme palette
        vault: {
          bg:           '#ffffff',   // --background-primary (base-00)
          sidebar:      '#fafafa',   // --background-primary-alt (base-10)
          surface:      '#f0f0f0',   // hover / selection surface
          border:       '#e0e0e0',   // --background-modifier-border (base-30)
          text:         '#222222',   // --text-normal (base-100)
          muted:        '#5c5c5c',   // --text-muted (base-70)
          faint:        '#ababab',   // --text-faint (base-50)
          accent:       '#7852ee',   // --color-purple (light theme)
          'accent-hover': '#6640d4',
          link:         '#7852ee',   // same as accent in Obsidian Publish
          tag:          '#08b94e',   // --color-green
        },
      },
      maxWidth: {
        content: '960px',
      },
      typography: (theme: (path: string) => string) => ({
        vault: {
          css: {
            '--tw-prose-body':        theme('colors.vault.text'),
            '--tw-prose-headings':    theme('colors.vault.text'),
            '--tw-prose-links':       theme('colors.vault.link'),
            '--tw-prose-code':        theme('colors.vault.text'),
            '--tw-prose-pre-bg':      theme('colors.vault.sidebar'),
            '--tw-prose-borders':     theme('colors.vault.border'),
            '--tw-prose-captions':    theme('colors.vault.muted'),
            '--tw-prose-counters':    theme('colors.vault.muted'),
            '--tw-prose-bullets':     theme('colors.vault.faint'),
            '--tw-prose-hr':          theme('colors.vault.border'),
            hr: { marginTop: '1em', marginBottom: '1em' },
            '--tw-prose-quotes':      theme('colors.vault.text'),
            '--tw-prose-th-borders':  theme('colors.vault.border'),
            '--tw-prose-td-borders':  theme('colors.vault.border'),
            color: theme('colors.vault.text'),
            fontSize: '16px',
            lineHeight: '1.6',
            a: {
              color: theme('colors.vault.link'),
              textDecoration: 'underline',
              fontWeight: 'inherit',
              '&:hover': { color: theme('colors.vault.accent-hover') },
            },
            'a.internal-link': {
              color: theme('colors.vault.accent'),
              '&:hover': { color: theme('colors.vault.accent-hover') },
            },
            'h1,h2,h3,h4': {
              color: theme('colors.vault.text'),
              fontWeight: '600',
            },
            h1: { fontSize: '2.6em', borderBottom: `1px solid ${theme('colors.vault.border')}`, paddingBottom: '0.2em', marginBottom: '0.4em' },
            h2: { fontSize: '1.8em', marginBottom: '0.2em' },
            h3: { fontSize: '1.4em' },
            p: { marginTop: '0.75em', marginBottom: '0.75em' },
            'code:not(pre code)': {
              background: theme('colors.vault.sidebar'),
              color: theme('colors.vault.text'),
              padding: '0.15em 0.4em',
              borderRadius: '3px',
              fontSize: '0.875em',
              fontWeight: 'normal',
            },
            pre: {
              background: theme('colors.vault.surface'),
              border: `1px solid ${theme('colors.vault.border')}`,
              borderRadius: '4px',
              color: theme('colors.vault.text'),
            },
            'pre code': {
              color: theme('colors.vault.text'),
              background: 'transparent',
            },
            blockquote: {
              borderLeftColor: theme('colors.vault.accent'),
              borderLeftWidth: '2px',
              color: 'inherit',
              fontStyle: 'normal',
              background: 'transparent',
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after':   { content: 'none' },
            'table th': {
              background: theme('colors.vault.sidebar'),
              color: theme('colors.vault.text'),
              borderColor: theme('colors.vault.border'),
            },
            'table td': { borderColor: theme('colors.vault.border') },
          },
        },
      }),
    },
  },
  plugins: [typography],
} satisfies Config
