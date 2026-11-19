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
}

export const COLECOES: Colecao[] = ['empresas', 'atas', 'contratos'];

export class ErroAcesso extends Error {
  constructor(msg = 'A pasta de dados não está acessível. Verifique a rede e tente de novo.') {
    super(msg);
    this.name = 'ErroAcesso';
  }
}
