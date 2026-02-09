import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import App from './App';

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('App', () => {
  it('renders the app title', () => {
    renderWithProviders(<App />);
    expect(screen.getByText('HazOp Assistant')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderWithProviders(<App />);
    expect(
      screen.getByText('Industrial safety analysis platform')
    ).toBeInTheDocument();
  });

  it('renders the get started button', () => {
    renderWithProviders(<App />);
    expect(
      screen.getByRole('button', { name: /get started/i })
    ).toBeInTheDocument();
  });
});
