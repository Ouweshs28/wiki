---
title: "Testing React Components with Vitest and React Testing Library"
sidebar_position: 1
---

# Testing React Components with Vitest

This guide provides a quick reference for setting up and writing tests with Vitest and React Testing Library. For a more detailed guide, see my [blog post on Vitest and React Testing Library](/blog/2025/12/07/vitest-react-testing-library).

## Quick Setup

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## Basic Example

```tsx
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Testing Async Components

```tsx
// UserProfile.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  it('loads user data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ name: 'John Doe' }),
    });

    render(<UserProfile userId="1" />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});
```

## Key Testing Patterns

1. **Test Behavior, Not Implementation**
   ```tsx
   // Good
   getByRole('button', { name: /submit/i });
   
   // Avoid
   getByTestId('submit-button');
   ```

2. **Mocking**
   ```typescript
   // Mock modules
   vi.mock('axios');
   
   // Mock browser APIs
   window.matchMedia = vi.fn().mockImplementation(query => ({
     matches: false,
     addListener: vi.fn(),
     removeListener: vi.fn(),
   }));
   ```

## Learn More

For a complete guide with detailed explanations and advanced patterns, check out my [blog post on Vitest and React Testing Library](/blog/2025/12/07/vitest-react-testing-library).

## Resources
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
