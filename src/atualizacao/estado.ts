import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Repositorio } from '../armazenamento/repositorio';
import { consultarPublicacao, haVersaoNova, type Publicacao } from './online';
import { situacaoVersao } from './compartilhada';
import { VERSAO_APP } from './versao';

export interface EstadoAtualizacao {
  publicacao: Publicacao | null;
  consultando: boolean;
  /** Momento da última consulta que respondeu; null se nunca respondeu (sem internet). */
  ultimaConsulta: number | null;
  falhou: boolean;
  /** Versão que outra pessoa instalou na pasta, quando esta janela ficou para trás. */
  versaoNaPasta: string | null;
  modalAberto: boolean;
  consultar(): Promise<void>;
  conferirPasta(repo: Repositorio, aoBloquear: (msg: string | null) => void): Promise<void>;
  abrirModal(aberto: boolean): void;
}

export const atualizacao = createStore<EstadoAtualizacao>()((set, get) => ({
  publicacao: null,
  consultando: false,
  ultimaConsulta: null,
  falhou: false,
  versaoNaPasta: null,
  modalAberto: false,

  async consultar() {
    if (get().consultando) return;
    set({ consultando: true });
    const p = await consultarPublicacao();
    set({ consultando: false, falhou: !p, ...(p ? { publicacao: p, ultimaConsulta: Date.now() } : {}) });
  },

  async conferirPasta(repo, aoBloquear) {
    const marcador = await repo.lerMarcador();
    if (!marcador) return; // pasta inacessível agora: tenta na próxima
    const s = situacaoVersao(marcador, VERSAO_APP);
    if (s.tipo === 'registrar') {
      await repo.atualizarMarcador({ ...s.marcador, atualizadoEm: new Date().toISOString() }).catch(() => {});
      set({ versaoNaPasta: null });
      aoBloquear(null);
    } else if (s.tipo === 'desatualizada') {
      set({ versaoNaPasta: s.versaoNaPasta });
      aoBloquear(
        `O sistema foi atualizado para a versão ${s.versaoNaPasta} e esta janela ainda está na ${VERSAO_APP}. Recarregue a página (F5) antes de salvar. O que já foi salvo não se perde.`,
      );
    } else {
      set({ versaoNaPasta: null });
      aoBloquear(null);
    }
  },

  abrirModal(aberto) {
    set({ modalAberto: aberto });
  },
}));

export const useAtualizacao = <T,>(sel: (e: EstadoAtualizacao) => T) => useStore(atualizacao, sel);

/** Há versão publicada mais nova que esta janela e que ninguém instalou ainda na pasta. */
export function ofereceAtualizacao(e: Pick<EstadoAtualizacao, 'publicacao' | 'versaoNaPasta'>): boolean {
  return !e.versaoNaPasta && haVersaoNova(e.publicacao);
}
