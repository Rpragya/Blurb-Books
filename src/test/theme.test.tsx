import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '../app/theme';

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe('ThemeToggle', () => {
  it('follows the system by default and remembers an explicit choice', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    // The jsdom stub reports a light system preference.
    const button = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(document.documentElement.dataset.theme).toBeUndefined();

    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('blurb-books:theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('starts from a stored choice', () => {
    window.localStorage.setItem('blurb-books:theme', 'dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});
