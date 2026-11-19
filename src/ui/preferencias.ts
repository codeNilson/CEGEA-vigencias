import { useState } from 'react';

/** Preferência visual guardada neste computador (não vai para a pasta de dados). */
export function usePreferencia<T extends string>(chave: string, padrao: T, validos: readonly T[]): [T, (v: T) => void] {
  const [valor, setValor] = useState<T>(() => {
    try {
      const v = localStorage.getItem(`vigencias.${chave}`) as T | null;
      return v && validos.includes(v) ? v : padrao;
    } catch {
      return padrao;
    }
  });
  const mudar = (v: T) => {
    setValor(v);
    try {
      localStorage.setItem(`vigencias.${chave}`, v);
    } catch {
      /* sem armazenamento local: vale só nesta sessão */
    }
  };
  return [valor, mudar];
}

export type ModoVencimentos = 'mes' | 'lista';
export const MODOS: readonly ModoVencimentos[] = ['mes', 'lista'];
