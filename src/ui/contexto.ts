import { useEffect, useState } from 'react';
import { create, useStore } from 'zustand';
import { criarLoja, type EstadoLoja, type Validador } from '../estado/loja';
import type { Agregado } from '../dominio/tipos';

export const loja = criarLoja({ usarCache: true });

export function useLoja<T>(seletor: (e: EstadoLoja) => T): T {
  return useStore(loja, seletor);
}

/** Grava e avisa. Retorna a lista de erros para o formulário (vazia = sucesso). */
export async function gravar(registro: Agregado, validar?: Validador, mensagem = 'Salvo na pasta de dados.'): Promise<string[]> {
  const r = await loja.getState().salvar(registro, validar);
  if (r.ok) {
    loja.getState().avisar(r.mesclado ? 'info' : 'ok', r.mesclado ? `${mensagem} Alterações de outro usuário foram incorporadas.` : mensagem);
    return [];
  }
  if (r.cancelado) return ['Gravação cancelada. Nada foi alterado.'];
  return r.erros;
}

// ---------- Rotas por hash (#/contrato/id), para o botão voltar do navegador funcionar ----------

export type Rota =
  | { tela: 'inicio' }
  | { tela: 'atas' }
  | { tela: 'contratos' }
  | { tela: 'ordens' }
  | { tela: 'empresas' }
  | { tela: 'visor' }
  | { tela: 'ata'; id: string; buscaItens?: string }
  | { tela: 'contrato'; id: string };

const LISTAS = ['atas', 'contratos', 'ordens', 'empresas', 'visor'] as const;

function lerRota(): Rota {
  const [caminho, consulta = ''] = location.hash.replace(/^#/, '').split('?');
  const [, tela, id] = caminho.split('/');
  if (tela === 'ata' && id) {
    // Revisão 9: a busca de itens em todas as ARPs abre a ARP com a busca de itens preenchida.
    const buscaItens = new URLSearchParams(consulta).get('itens') ?? '';
    return buscaItens ? { tela, id: decodeURIComponent(id), buscaItens } : { tela, id: decodeURIComponent(id) };
  }
  if (tela === 'contrato' && id) return { tela, id: decodeURIComponent(id) };
  if ((LISTAS as readonly string[]).includes(tela)) return { tela } as Rota;
  return { tela: 'inicio' };
}

export function hrefDe(r: Rota): string {
  if (r.tela === 'inicio') return '#/';
  if (r.tela === 'ata' && r.buscaItens) return `#/ata/${encodeURIComponent(r.id)}?${new URLSearchParams({ itens: r.buscaItens })}`;
  if (r.tela === 'ata' || r.tela === 'contrato') return `#/${r.tela}/${encodeURIComponent(r.id)}`;
  return `#/${r.tela}`;
}

export function irPara(r: Rota) {
  location.hash = hrefDe(r);
  window.scrollTo({ top: 0 });
}

export function useRota(): Rota {
  const [rota, setRota] = useState(lerRota);
  useEffect(() => {
    const f = () => setRota(lerRota());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return rota;
}

// ---------- OF/OS aberta na gaveta lateral (detalhe da ordem) ----------

export const useOrdemAberta = create<{ aberta: { contratoId: string; ordemId: string } | null; abrir: (contratoId: string, ordemId: string) => void; fechar: () => void }>((set) => ({
  aberta: null,
  abrir: (contratoId, ordemId) => set({ aberta: { contratoId, ordemId } }),
  fechar: () => set({ aberta: null }),
}));
