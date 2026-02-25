# FRONTEND-TDD — React Native Reducer TDD

## Pattern

Extract state logic to a **pure reducer module**. Test state transitions as pure functions. Wire into component LAST.

## Steps

1. Define the state type and action types
2. Write the reducer as a pure function in `*.reducer.ts`
3. Test every state transition (no DOM, no React, no Testing Library)
4. Wire into component via `useReducer` — component stays thin

## Rules

1. **Reducer is a pure function** — `(state, action) => state`
2. **No side effects in reducer** — API calls happen in the component/hook layer
3. **Test the reducer directly** — import and call it, assert on returned state
4. **Component layer is thin** — `dispatch` + `render`, minimal logic
5. **One test at a time**: RED → GREEN → next

## Example

```typescript
// session.reducer.ts
export type SessionState = {
  currentQuestion: Question | null;
  answered: number;
  correct: number;
  status: "idle" | "active" | "complete";
};

export type SessionAction =
  | { type: "START_SESSION" }
  | { type: "ANSWER_QUESTION"; correct: boolean }
  | { type: "NEXT_QUESTION"; question: Question }
  | { type: "COMPLETE_SESSION" };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  // ...
}
```

```typescript
// __tests__/session.reducer.test.ts
it("increments correct count on correct answer", () => {
  const state = sessionReducer(activeState, { type: "ANSWER_QUESTION", correct: true });
  expect(state.correct).toBe(1);
  expect(state.answered).toBe(1);
});
```

## File Structure

```
apps/native/features/session/
├── session.reducer.ts
├── session.screen.tsx          # Thin: useReducer + render
└── __tests__/
    └── session.reducer.test.ts
```
