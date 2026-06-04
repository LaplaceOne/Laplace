import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from './CopyButton.js';

test('copies value to clipboard and shows confirmation', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });

  render(<CopyButton value="npm i @laplace-one/sdk" label="copy" />);
  fireEvent.click(screen.getByRole('button'));

  expect(writeText).toHaveBeenCalledWith('npm i @laplace-one/sdk');
  await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent(/copied/i));
});
