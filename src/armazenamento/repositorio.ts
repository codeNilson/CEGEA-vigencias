import type { Colecao } from '../dominio/tipos';

export interface EntradaArquivo {
  id: string;
  modificadoEm: number;
}

export interface Lido {
  dados: unknown;
  modificadoEm: number;
}

/** Fonte da verdade dos dados (design.md 2.3). */
export interface Repositorio {
  readonly nome: string;
  listar(colecao: Colecao): Promise<EntradaArquivo[]>;
  ler(colecao: Colecao, id: string): Promise<Lido | null>;
  gravar(colecao: Colecao, id: string, dados: unknown): Promise<void>;
  excluir(colecao: Colecao, id: string): Promise<void>;
  /** Conteúdo de _vigencias.json (marcador da pasta, com a versão do sistema). Null se não der para ler. */
  lerMarcador(): Promise<Record<string, unknown> | null>;
  /** Junta os campos ao marcador e grava. */
  atualizarMarcador(campos: Record<string, unknown>): Promise<void>;
}

export const COLECOES: Colecao[] = ['empresas', 'atas', 'contratos'];

export class ErroAcesso extends Error {
  constructor(msg = 'A pasta de dados não está acessível. Verifique a rede e tente de novo.') {
    super(msg);
    this.name = 'ErroAcesso';
  }
}
