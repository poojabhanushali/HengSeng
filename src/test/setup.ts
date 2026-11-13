import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Silence Recharts/resize observer in jsdom
const { ResizeObserver } = window;
if (!ResizeObserver) {
  (window as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
