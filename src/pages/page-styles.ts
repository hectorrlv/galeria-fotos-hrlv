import { css } from 'lit';

export const pageStyles = css`
  :host {
    display: block;
  }

  .page {
    display: grid;
    gap: clamp(2.5rem, 7vw, 6rem);
    padding-block: clamp(3rem, 8vw, 7rem);
  }

  .intro {
    display: grid;
    align-content: center;
    gap: 1rem;
    min-height: min(50vh, 34rem);
  }

  h1,
  h2,
  p {
    margin-block: 0;
  }

  h1,
  .display {
    max-width: 60rem;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(2.6rem, 8vw, 6.6rem);
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.045em;
  }

  h2 {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(1.9rem, 4vw, 3.4rem);
    font-weight: 400;
  }

  p {
    max-width: 46rem;
    color: var(--color-text-muted);
    line-height: 1.7;
  }

  .lead {
    font-size: clamp(1rem, 2vw, 1.2rem);
  }

  .eyebrow {
    color: var(--color-accent);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.17em;
    text-transform: uppercase;
  }

  .section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: clamp(2rem, 5vw, 4rem) clamp(1.25rem, 3vw, 2rem);
  }

  .empty,
  .error {
    padding: clamp(2rem, 6vw, 4rem);
    border: 1px solid var(--color-border);
    border-radius: 0.4rem;
    background: var(--color-surface);
  }

  .error {
    border-color: #8a4b45;
  }

  .text-link {
    color: var(--color-accent);
    text-underline-offset: 0.25rem;
  }

  button,
  select,
  input,
  textarea {
    font: inherit;
  }
`;
