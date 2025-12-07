---
title: "Setting Up Vitest and React Testing Library for React Applications"
date: '2025-12-07'
authors: [ouwesh]
tags: [react, testing, vitest, react-testing-library, typescript]
slug: 2025/12/07/vitest-react-testing-library
---

# Setting Up Vitest and React Testing Library for React Applications

In this guide, we'll walk through setting up a robust testing environment for your React application using Vitest and React Testing Library. This combination provides a modern, fast, and efficient way to test your React components.

<!-- truncate -->

## Prerequisites

- Node.js (v20 or later)
- npm or yarn
- Basic knowledge of React and TypeScript

## Setting Up a New React Project with Vite

First, let's create a new React project with Vite and TypeScript:

```bash
npm create vite@latest my-react-app -- --template react-ts
cd my-react-app
npm install
```

## Installing Testing Dependencies

### 1. Install Vitest

Vitest is a modern test runner that's compatible with Jest's API but built with Vite's native support in mind:

```bash
npm install --save-dev vitest
```

Add a test script to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch"
  }
}
```

### 2. Install JSDOM

JSDOM provides a browser-like environment for testing:

```bash
npm install --save-dev jsdom @vitest/ui
```

### 3. Install React Testing Library

React Testing Library helps you test components in a way that resembles how users interact with your app:

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Configuration

### 1. Configure Vite

Update your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
} as UserConfig);
```

### 2. Create Test Setup File

Create `src/test/setup.ts`:

```typescript
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Clear all mocks and cleanup DOM after each test
// This ensures tests are isolated from each other
afterEach(() => {
  cleanup();
});
```

## Writing Your First Test

Let's create a simple test for a sample component. First, create a component:

```tsx
// src/components/Greeting.tsx
interface GreetingProps {
  name?: string;
}

export function Greeting({ name = 'World' }: GreetingProps) {
  return <h1>Hello, {name}!</h1>;
}
```

Now, create a test file:

```tsx
// src/components/__tests__/Greeting.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Greeting } from '../Greeting';

describe('Greeting Component', () => {
  it('renders default greeting when no name is provided', () => {
    render(<Greeting />);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  it('renders personalized greeting when name is provided', () => {
    render(<Greeting name="Alice" />);
    expect(screen.getByText('Hello, Alice!')).toBeInTheDocument();
  });
});
```

## Running Tests

Run your tests with:

```bash
# Run tests once
npm test

# Run in watch mode (recommended during development)
npm run test:watch

```

## Key Benefits of This Setup

1. **Fast Refresh**: Vitest provides instant test feedback with its watch mode
2. **TypeScript Support**: Full TypeScript support out of the box
3. **Jest Compatibility**: Most Jest APIs are supported, making migration easy
4. **React 18 Support**: Full compatibility with React 18's concurrent features
5. **Component Testing**: Easy testing of components with React Testing Library

## Common Testing Patterns

### Testing User Interactions

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
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

### Testing Async Operations

```tsx
describe('UserProfile', () => {
  it('loads and displays user data', async () => {
    const mockUser = { name: 'John', email: 'john@example.com' };
    
    // Mock API call
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockUser),
      })
    ) as any;

    render(<UserProfile userId="123" />);
    
    // Wait for the component to update
    expect(await screen.findByText('Loading...')).toBeInTheDocument();
    expect(await screen.findByText('John')).toBeInTheDocument();
    expect(await screen.findByText('john@example.com')).toBeInTheDocument();
  });
});
```

## Tips for Effective Testing

1. **Test Behavior, Not Implementation**: Focus on what users see and do, not internal component state
2. **Use `screen` for Queries**: Always use `screen` from `@testing-library/react` for queries
3. **Prefer `findBy` for Async**: Use `findBy` queries for elements that appear asynchronously
4. **Mock External Dependencies**: Mock API calls and other external services
5. **Keep Tests Isolated**: Each test should be independent of others

## Conclusion

Setting up Vitest with React Testing Library provides a powerful, modern testing solution for your React applications. The combination of Vitest's speed and React Testing Library's focus on user-centric testing makes for a great developer experience while ensuring your tests are maintainable and effective.

For more information, check out the official documentation:
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Vite Documentation](https://vitejs.dev/)
