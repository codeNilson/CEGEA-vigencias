import type { Colecao } from '../dominio/tipos';
import type { EntradaArquivo, Lido, Repositorio } from './repositorio';

/** Repositório em memória: testes e modo demonstração. Vários "usuários" podem compartilhar a mesma instância. */
export class RepositorioMemoria implements Repositorio {
  readonly nome: string;
  private arquivos = new Map<string, { texto: string; modificadoEm: number }>();
  private relogio = 1;

  constructor(nome = 'Demonstração (memória)') {
    this.nome = nome;
  }

  private chave(c: Colecao, id: string) {
    return `${c}/${id}`;
  }

  async listar(colecao: Colecao): Promise<EntradaArquivo[]> {
    const r: EntradaArquivo[] = [];
    for (const [k, v] of this.arquivos) if (k.startsWith(colecao + '/')) r.push({ id: k.slice(colecao.length + 1), modificadoEm: v.modificadoEm });
    return r;
  }

  async ler(colecao: Colecao, id: string): Promise<Lido | null> {
    const a = this.arquivos.get(this.chave(colecao, id));
    return a ? { dados: JSON.parse(a.texto), modificadoEm: a.modificadoEm } : null;
  }

  async gravar(colecao: Colecao, id: string, dados: unknown): Promise<void> {
    this.arquivos.set(this.chave(colecao, id), { texto: JSON.stringify(dados), modificadoEm: this.relogio++ });
  }

  async excluir(colecao: Colecao, id: string): Promise<void> {
    this.arquivos.delete(this.chave(colecao, id));
  }

  /** Gravação direta, simulando outro computador (testes). */
  gravarBruto(colecao: Colecao, id: string, texto: string) {
    this.arquivos.set(this.chave(colecao, id), { texto, modificadoEm: this.relogio++ });
  }
}
