/**
 * Monta a publicação de uma versão (revisão 6), rodado pelo CI depois do build:
 *   publicacao/versao.json                    o que o sistema consulta para saber se há versão nova
 *   publicacao/versoes/Vigencias-X.Y.Z.html   o arquivo da versão (caminho imutável)
 *   publicacao/notas-X.Y.Z.md                 texto da GitHub Release
 * Uso: npx vite-node scripts/publicar.ts [tag]   (a tag, se informada, precisa bater com o package.json)
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { lerChangelog } from '../src/atualizacao/notas';

const pacote = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const versao = pacote.version;
const tag = process.argv[2];
if (tag && tag.replace(/^v/, '') !== versao) {
  console.error(`A tag ${tag} não bate com a versão ${versao} do package.json.`);
  process.exit(1);
}

const notas = lerChangelog(readFileSync('CHANGELOG.md', 'utf8'));
const desta = notas.find((n) => n.versao === versao);
if (!desta) {
  console.error(`CHANGELOG.md não tem a seção da versão ${versao}.`);
  process.exit(1);
}

const html = readFileSync('dist/Vigencias.html');
if (!html.toString('utf8').includes(`"${versao}"`)) {
  console.error(`dist/Vigencias.html não parece ser a versão ${versao}. Rode o build antes.`);
  process.exit(1);
}

const arquivo = `versoes/Vigencias-${versao}.html`;
mkdirSync('publicacao/versoes', { recursive: true });
writeFileSync(`publicacao/${arquivo}`, html);
writeFileSync(
  'publicacao/versao.json',
  JSON.stringify(
    {
      versao,
      data: desta.data || new Date().toISOString().slice(0, 10),
      arquivo,
      sha256: createHash('sha256').update(html).digest('hex'),
      tamanho: html.length,
      // Últimas 10 versões, para quem estiver vários passos atrás ver tudo o que mudou.
      notas: notas.slice(0, 10),
    },
    null,
    2,
  ) + '\n',
);

const md = desta.secoes.map((s) => `### ${s.titulo}\n\n${s.itens.map((i) => `- ${i}`).join('\n')}`).join('\n\n');
writeFileSync(`publicacao/notas-${versao}.md`, md + '\n');
console.log(`Publicação ${versao} pronta em publicacao/ (${html.length} bytes).`);
