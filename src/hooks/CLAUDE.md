# Hooks - sftools React Hooks

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

This directory contains **shared React hooks** used across multiple components in the sftools extension.

## Directory Structure

```
hooks/
├── useFilteredResults.ts  # Debounced text filtering state
└── useStatusBadge.ts      # Status badge state management
```

## Available Hooks

### useFilteredResults

Hook for managing filtered results with debounced input. Provides filter state and handlers for text-based filtering.

### useStatusBadge

Shared hook for status badge state management. Works with the `StatusBadge` component.

## Adding Custom Hooks

For hooks used across multiple components, add them here. For hooks specific to a single component, colocate them in the component folder.

## Best Practices

### MUST Follow

1. **Use TypeScript** - Full type annotations for parameters and returns
2. **Follow React rules** - Hooks must start with `use`, follow rules of hooks

### SHOULD Follow

1. **Colocate component-specific hooks** - Put them in the component folder
2. **Document with JSDoc** - Describe parameters and return values

### SHOULD NOT

1. **Don't create hooks for single use** - Extract only when reused
