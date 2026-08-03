import { css } from 'lit';

export const pageStyles = css`
  :host {
    display: block;
  }

  section {
    min-height: min(62vh, 42rem);
    display: grid;
    align-content: center;
    gap: 1rem;
    padding-block: clamp(3rem, 10vw, 8rem);
  }

  p {
    max-width: 44rem;
    margin: 0;
    color: var(--color-text-muted);
    font-size: clamp(1rem, 2vw, 1.2rem);
    line-height: 1.7;
  }

  h1 {
    max-width: 58rem;
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(2.5rem, 8vw, 6.5rem);
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  .eyebrow {
    color: var(--color-accent);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
`;
