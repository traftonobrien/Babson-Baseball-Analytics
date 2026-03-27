"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

interface KeyedState<K, T> {
  key: K;
  value: T;
}

export function useKeyedState<K, T>(
  key: K,
  createInitialValue: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  // Reset the stored value whenever the caller's identity key changes.
  const [state, setState] = useState<KeyedState<K, T>>(() => ({
    key,
    value: createInitialValue(),
  }));

  const value = Object.is(state.key, key) ? state.value : createInitialValue();

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (nextValue) => {
      setState((prev) => {
        const baseValue = Object.is(prev.key, key) ? prev.value : createInitialValue();
        return {
          key,
          value:
            typeof nextValue === "function"
              ? (nextValue as (currentValue: T) => T)(baseValue)
              : nextValue,
        };
      });
    },
    [key, createInitialValue],
  );

  return [value, setValue];
}
