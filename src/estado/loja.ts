import { createStore } from 'zustand/vanilla';
import { hojeISO } from '../dominio/datas';
import { mesclar, type Conflito, type Escolhas } from '../dominio/mesclagem';
import {
  COLECAO_DO_REGISTRO,
  validarArquivo,
  type Agregado,
  type Ata,
  type Colecao,
  type Contrato,
  type Empresa,
} from '../dominio/tipos';
import { gravarLocal, lerLocal } from '../armazenamento/idb';
import { COLECOES, ErroAcesso, type Repositorio } from '../armazenamento/repositorio';

export interface Problema {
  colecao: Colecao;
  id: string;
  erro: string;
}

export interface PedidoConflito {
  /** Registro como eu deixei. */
  minha: Agregado;
  /** Registro como está na pasta (null = excluído por outro usuário). */
  deles: Agregado | null;
  base: Agregado | undefined;
  conflitos: Conflito[];
}

/** Resposta ao conflito: escolhas campo a campo, ou recriar/descartar quando o outro excluiu. */
export type RespostaConflito = { tipo: 'escolhas'; escolhas: Escolhas } | { tipo: 'recriar' } | { tipo: 'cancelar' };

export type Validador = (registro: Agregado, estado: EstadoLoja) => string[];

export type ResultadoSalvar =
  | { ok: true; registro: Agregado; mesclado: boolean }
  | { ok: false; erros: string[]; cancelado?: boolean };

export interface Aviso {
  id: number;
  tipo: 'ok' | 'info' | 'erro';
  texto: string;
}

export interface EstadoLoja {
  repo: Repositorio | null;
  hoje: string;
  empresas: Map<string, Empresa>;
  atas: Map<string, Ata>;
  contratos: Map<string, Contrato>;
  problemas: Problema[];
  carregando: boolean;
  ultimaLeitura: number | null;
  haAlteracoes: boolean;
  conflito: (PedidoConflito & { responder: (r: RespostaConflito) => void }) | null;
  avisos: Aviso[];
  /** Mensagem que impede gravar: esta janela tem uma versão do sistema mais antiga que a da pasta (revisão 6). */
  bloqueioVersao: string | null;

  conectar(repo: Repositorio): Promise<void>;
  desconectar(): void;
  carregar(): Promise<void>;
  verificarAlteracoes(): Promise<boolean>;
  salvar(registro: Agregado, validar?: Validador): Promise<ResultadoSalvar>;
  excluir(registro: Agregado, verificar?: (estado: EstadoLoja) => string[]): Promise<ResultadoSalvar>;
  avisar(tipo: Aviso['tipo'], texto: string): void;
  dispensarAviso(id: number): void;
  definirBloqueioVersao(msg: string | null): void;
}

export interface OpcoesLoja {
  /** Usa cache local de leitura (IndexedDB). Desligado em testes e na demonstração. */
  usarCache?: boolean;
  /** Para testes: responde conflitos sem interface. */
  resolverConflito?: (p: PedidoConflito) => Promise<RespostaConflito>;
  agora?: () => Date;
}

const MAX_TENTATIVAS = 4;
let seqAviso = 1;

export function criarLoja(opcoes: OpcoesLoja = {}) {
  const agora = opcoes.agora ?? (() => new Date());
  /** Versão-base de cada registro: como estava quando foi lido (design.md 4.1). */
  const bases = new Map<string, Agregado>();
  /** Última data de modificação vista de cada arquivo. */
  const vistos = new Map<string, number>();

  const chave = (c: Colecao, id: string) => `${c}/${id}`;

  const loja = createStore<EstadoLoja>()((set, get) => {
    function aplicar(registro: Agregado | null, col: Colecao, id: string) {
      const mapa = { empresas: 'empresas', atas: 'atas', contratos: 'contratos' }[col] as 'empresas' | 'atas' | 'contratos';
      const novo = new Map(get()[mapa] as Map<string, Agregado>);
      if (registro) novo.set(id, registro);
      else novo.delete(id);
      set({ [mapa]: novo } as Partial<EstadoLoja>);
    }

    async function pedirResolucao(p: PedidoConflito): Promise<RespostaConflito> {
      if (opcoes.resolverConflito) return opcoes.resolverConflito(p);
      return new Promise((responder) => {
        set({
          conflito: {
            ...p,
            responder: (r) => {
              set({ conflito: null });
              responder(r);
            },
          },
        });
      });
    }

    async function lerColecao(repo: Repositorio, col: Colecao) {
      const entradas = await repo.listar(col);
      const registros: Agregado[] = [];
      const problemas: Problema[] = [];
      await Promise.all(
        entradas.map(async (e) => {
          const k = chave(col, e.id);
          let dados: unknown;
          let mod = e.modificadoEm;
          const cacheK = `${repo.nome}/${k}`;
          const emCache = opcoes.usarCache ? await lerLocal<{ m: number; d: unknown }>('cache', cacheK) : undefined;
          if (emCache && emCache.m === e.modificadoEm) {
            dados = emCache.d;
          } else {
            const lido = await repo.ler(col, e.id);
            if (!lido) return;
            dados = lido.dados;
            mod = lido.modificadoEm;
            if (opcoes.usarCache) await gravarLocal('cache', cacheK, { m: mod, d: dados });
          }
          vistos.set(k, mod);
          const v = validarArquivo(col, dados);
          if (v.ok && v.valor.id === e.id) {
            registros.push(v.valor);
          } else {
            problemas.push({ colecao: col, id: e.id, erro: v.ok ? 'id do conteúdo difere do nome do arquivo' : v.erro });
          }
        }),
      );
      return { registros, problemas };
    }

    return {
      repo: null,
      hoje: hojeISO(agora()),
      empresas: new Map(),
      atas: new Map(),
      contratos: new Map(),
      problemas: [],
      carregando: false,
      ultimaLeitura: null,
      haAlteracoes: false,
      conflito: null,
      avisos: [],
      bloqueioVersao: null,

      async conectar(repo) {
        set({ repo });
        await get().carregar();
      },

      desconectar() {
        bases.clear();
        vistos.clear();
        set({ repo: null, empresas: new Map(), atas: new Map(), contratos: new Map(), problemas: [], ultimaLeitura: null });
      },

      async carregar() {
        const repo = get().repo;
        if (!repo) return;
        set({ carregando: true });
        try {
          vistos.clear();
          const [e2, a2, c2] = await Promise.all(COLECOES.map((col) => lerColecao(repo, col)));
          bases.clear();
          for (const r of [...e2.registros, ...a2.registros, ...c2.registros]) bases.set(r.id, r);
          set({
            empresas: new Map(e2.registros.map((r) => [r.id, r as Empresa])),
            atas: new Map(a2.registros.map((r) => [r.id, r as Ata])),
            contratos: new Map(c2.registros.map((r) => [r.id, r as Contrato])),
            problemas: [...e2.problemas, ...a2.problemas, ...c2.problemas],
            ultimaLeitura: agora().getTime(),
            haAlteracoes: false,
            hoje: hojeISO(agora()),
          });
        } catch (err) {
          get().avisar('erro', err instanceof Error ? err.message : 'Falha ao ler a pasta de dados.');
        } finally {
          set({ carregando: false });
        }
      },

      async verificarAlteracoes() {
        const repo = get().repo;
        if (!repo) return false;
        try {
          const atuais = new Map<string, number>();
          const listas = await Promise.all(COLECOES.map((col) => repo.listar(col)));
          COLECOES.forEach((col, i) => listas[i].forEach((x) => atuais.set(chave(col, x.id), x.modificadoEm)));
          let mudou = atuais.size !== vistos.size;
          if (!mudou) for (const [k, m] of atuais) if (vistos.get(k) !== m) mudou = true;
          if (mudou) set({ haAlteracoes: true });
          return mudou;
        } catch {
          return false;
        }
      },

      async salvar(registro, validar) {
        const repo = get().repo;
        if (!repo) return { ok: false, erros: ['Nenhuma pasta de dados conectada.'] };
        const bloqueio = get().bloqueioVersao;
        if (bloqueio) return { ok: false, erros: [bloqueio] };
        const col = COLECAO_DO_REGISTRO[registro.registro];
        const id = registro.id;

        try {
          // A base precisa ser a versão que o usuário tinha ao editar. Captura antes de qualquer recarga,
          // senão a recarga abaixo trocaria a base pela versão do disco e esconderia o conflito.
          const baseDaEdicao = bases.get(id);
          // Regra que atravessa arquivos (design.md 4.3): contrato com ata valida saldo com dados frescos.
          if (validar && registro.registro === 'contrato' && registro.ataId) {
            await get().carregar();
            if (baseDaEdicao) bases.set(id, baseDaEdicao);
          }
          if (validar) {
            const erros = validar(registro, get());
            if (erros.length) return { ok: false, erros };
          }

          let minha: Agregado = registro;
          let base = baseDaEdicao;
          let mesclado = false;

          for (let t = 0; t < MAX_TENTATIVAS; t++) {
            const lido = await repo.ler(col, id);
            const v = lido ? validarArquivo(col, lido.dados) : null;
            const deles = v && v.ok ? v.valor : null;
            let final: Agregado;

            if (!deles) {
              if (base && base.versao > 0 && lido === null) {
                // Excluído por outro usuário enquanto eu editava (design.md 4.2).
                const r = await pedirResolucao({ minha, deles: null, base, conflitos: [] });
                if (r.tipo !== 'recriar') {
                  bases.delete(id);
                  aplicar(null, col, id);
                  return { ok: false, erros: [], cancelado: true };
                }
              }
              final = { ...minha, versao: (base?.versao ?? 0) + 1 };
            } else if (base && deles.versao === base.versao) {
              final = { ...minha, versao: deles.versao + 1 };
            } else {
              let r = mesclar<Agregado>(base, minha, deles);
              if (r.conflitos.length) {
                const resp = await pedirResolucao({ minha, deles, base, conflitos: r.conflitos });
                if (resp.tipo !== 'escolhas') return { ok: false, erros: [], cancelado: true };
                r = mesclar<Agregado>(base, minha, deles, resp.escolhas);
              }
              final = { ...r.resultado, versao: deles.versao + 1 };
              mesclado = true;
              if (validar) {
                const erros = validar(final, get());
                if (erros.length) return { ok: false, erros: ['Após juntar com as alterações de outro usuário:', ...erros] };
              }
            }

            final = { ...final, atualizadoEm: agora().toISOString() };
            await repo.gravar(col, id, final);

            // Releitura: confere se a versão gravada é a minha (design.md 4.1, passo 6).
            const conferido = await repo.ler(col, id);
            const dc = conferido?.dados as Partial<Agregado> | undefined;
            if (conferido && dc?.versao === final.versao && dc.atualizadoEm === final.atualizadoEm) {
              bases.set(id, final);
              vistos.set(chave(col, id), conferido.modificadoEm);
              aplicar(final, col, id);
              return { ok: true, registro: final, mesclado };
            }
            // Outro usuário gravou no mesmo instante: tenta de novo a partir do disco.
            if (deles) base = deles;
            minha = final;
          }
          return { ok: false, erros: ['Não foi possível gravar: o registro está sendo alterado por outro usuário. Tente de novo.'] };
        } catch (e) {
          return { ok: false, erros: [e instanceof ErroAcesso ? e.message : `Erro ao gravar: ${e instanceof Error ? e.message : e}`] };
        }
      },

      async excluir(registro, verificar) {
        const repo = get().repo;
        if (!repo) return { ok: false, erros: ['Nenhuma pasta de dados conectada.'] };
        const bloqueio = get().bloqueioVersao;
        if (bloqueio) return { ok: false, erros: [bloqueio] };
        const col = COLECAO_DO_REGISTRO[registro.registro];
        try {
          if (verificar) {
            await get().carregar();
            const deps = verificar(get());
            if (deps.length) return { ok: false, erros: deps };
          }
          await repo.excluir(col, registro.id);
          bases.delete(registro.id);
          vistos.delete(chave(col, registro.id));
          aplicar(null, col, registro.id);
          return { ok: true, registro, mesclado: false };
        } catch (e) {
          return { ok: false, erros: [e instanceof Error ? e.message : String(e)] };
        }
      },

      avisar(tipo, texto) {
        const id = seqAviso++;
        set({ avisos: [...get().avisos, { id, tipo, texto }] });
        setTimeout(() => get().dispensarAviso(id), tipo === 'erro' ? 9000 : 4500);
      },

      dispensarAviso(id) {
        set({ avisos: get().avisos.filter((a) => a.id !== id) });
      },

      definirBloqueioVersao(msg) {
        if (get().bloqueioVersao !== msg) set({ bloqueioVersao: msg });
      },
    };
  });

  return loja;
}

export type Loja = ReturnType<typeof criarLoja>;
