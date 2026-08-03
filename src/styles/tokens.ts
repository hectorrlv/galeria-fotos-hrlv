import { css } from 'lit';

export const themeStyles = css`
  :host {
    --color-background: #11110f;
    --color-surface: #1b1b18;
    --color-surface-raised: #252520;
    --color-text: #f3efe5;
    --color-text-muted: #b9b3a6;
    --color-border: #3a3932;
    --color-accent: #d8c49b;
    --content-width: 80rem;
    --space-page: clamp(1rem, 4vw, 3rem);
    color: var(--color-text);
    background: var(--color-background);
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  a {
    color: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
