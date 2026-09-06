/** Build the teaching workbook from the canonical NC-2026.1 CSVs.
 * Run: node scripts/build_workbook.mjs
 * Optional: ARTIFACT_TOOL_NODE_MODULES points to the runtime's node_modules.
 * Source files and their historical values are never rewritten here.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'nucleo-casa-workbook-'));
const dependencies = process.env.ARTIFACT_TOOL_NODE_MODULES || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
await fs.symlink(dependencies, path.join(scratch, 'node_modules'), 'dir');
const requireRuntime = createRequire(path.join(scratch, 'package.json'));
const { Workbook, SpreadsheetFile } = await import(pathToFileURL(requireRuntime.resolve('@oai/artifact-tool')).href);
const wb = Workbook.create();
const names = ['Leia-me', 'Resumo', 'Vendas', 'Pessoas', 'Estoque', 'Mensal', 'Canais', 'Regioes', 'Cenarios', 'Exercicios', 'Dicionario', 'Fontes'];
const sheets = Object.fromEntries(names.map(name => [name, wb.worksheets.add(name)]));
const content = JSON.parse(await fs.readFile(path.join(root, 'content.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'resources/dados/resumo.json'), 'utf8'));
const font = 'Helvetica Neue';
const money = '"R$" #,##0.00;[Red]("R$" #,##0.00)';
const integer = '#,##0';
const percent = '0.0%';
const palette = { ink: '#243447', muted: '#637083', blue: '#334F70', pale: '#F3F6FA', input: '#FFF4D4', line: '#DCE3EB' };
const col = n => { let s = ''; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const cell = (s, address, value, formula = false) => { sheets[s].getRange(address)[formula ? 'formulas' : 'values'] = [[value]]; };

function frame(name, title, note, headers, rows, widths, { freeze = true, filter = true, height = 24 } = {}) {
  const s = sheets[name], last = col(headers.length - 1), end = rows.length + 5;
  s.showGridLines = false;
  s.getRange(`A1:${last}${Math.max(end, 6)}`).format.font = { name: font, size: 11, color: palette.ink };
  s.getRange(`A1:${last}${Math.max(end, 6)}`).format.rowHeight = height;
  s.getRange(`A1:${last}1`).format.rowHeight = 32;
  s.getRange(`A2:${last}2`).format.rowHeight = 22;
  s.getRange(`A3:${last}4`).format.rowHeight = 10;
  s.getRange(`A6:${last}${Math.max(end, 6)}`).format.verticalAlignment = 'center';
  s.getRange(`A3:${last}3`).format.borders = { bottom: { style: 'thin', color: palette.line } };
  cell(name, 'A1', title);
  s.getRange('A1').format.font = { name: font, size: 18, bold: true, color: palette.ink };
  cell(name, 'A2', note);
  s.getRange('A2').format.font = { name: font, size: 10, italic: true, color: palette.muted };
  s.getRange(`A5:${last}5`).values = [headers];
  if (rows.length) s.getRange(`A6:${last}${end}`).values = rows;
  if (filter && rows.length) {
    const table = s.tables.add(`A5:${last}${end}`, true, `NC_${name.replace('-', '_')}`);
    table.style = 'TableStyleLight1';
    table.showFilterButton = true;
  }
  s.getRange(`A5:${last}5`).format = { fill: palette.blue, font: { name: font, color: '#FFFFFF', bold: true, size: 11 }, wrapText: true, rowHeight: 46, verticalAlignment: 'center', horizontalAlignment: 'center' };
  s.getRange(`A5:${last}5`).format.borders = { insideVertical: { style: 'thin', color: '#FFFFFF' } };
  widths.forEach((width, i) => { s.getRange(`${col(i)}1:${col(i)}${Math.max(end, 6)}`).format.columnWidth = width; });
  if (freeze) s.freezePanes.freezeRows(5);
  return s;
}
function formulaColumn(name, c, formula, end) {
  cell(name, `${c}6`, formula, true);
  if (end > 6) sheets[name].getRange(`${c}6:${c}${end}`).fillDown();
}
function formatColumns(name, columns, format, end) {
  for (const c of columns) sheets[name].getRange(`${c}6:${c}${end}`).setNumberFormat(format);
}
function ratio(n, d, scale = '') { return `IF(${d}=0,"",${scale}${n}/${d})`; }

// Import through the documented CSV API, then type dates and numbers explicitly.
const raw = {};
for (const [name, file, numericStart] of [['Vendas', 'nucleo-casa-mensal.csv', 4], ['Pessoas', 'pessoas-mensal.csv', 2], ['Estoque', 'estoque-mensal.csv', 2]]) {
  const imported = await Workbook.fromCSV(await fs.readFile(path.join(root, 'resources/dados', file), 'utf8'), { sheetName: 'Import' });
  const matrix = imported.worksheets.getItemAt(0).getUsedRange().values;
  const headers = matrix[0], rows = matrix.slice(1).filter(r => r[0] !== null && r[0] !== '');
  raw[name] = { headers, file, rows: rows.map(r => r.map((v, i) => i >= numericStart ? Number(v) : String(v))) };
}
assert.equal(raw.Vendas.rows.length, manifest.registros_mensais);
assert.equal(raw.Vendas.rows.reduce((sum, r) => sum + Math.round(r[5] * 100), 0), manifest.receita_bruta_total * 100);
assert.equal(raw.Vendas.rows.reduce((sum, r) => sum + r[4], 0), manifest.pedidos_total);
for (const name of ['Vendas', 'Pessoas', 'Estoque']) {
  const data = raw[name], idx = data.headers.indexOf('id');
  assert.equal(new Set(data.rows.map(r => r[idx])).size, data.rows.length);
}
for (const row of raw.Vendas.rows) {
  assert.equal(Math.round(row[8] * 100), Math.round(row[5] * 100) - Math.round(row[6] * 100) - Math.round(row[7] * 100));
  assert(row[14] <= row[4] && row[15] <= row[4] && row[17] + row[18] <= row[16]);
}
for (const row of raw.Estoque.rows) {
  const matching = raw.Vendas.rows.filter(r => r[0] === row[1]);
  assert.equal(matching.length, 12);
  assert.equal(matching.reduce((sum, r) => sum + Math.round(r[9] * 100), 0), Math.round(row[2] * 100));
}

const salesExtra = ['ano', 'trimestre', 'margem_bruta_valor', 'margem_bruta_pct', 'contribuicao_valor', 'contribuicao_pct', 'ticket_bruto', 'cac_gerencial', 'taxa_atraso', 'taxa_devolucao', 'nps', 'taxa_desconto', 'conferencia_receita'];
for (const name of ['Vendas', 'Pessoas', 'Estoque']) {
  const d = raw[name], dateIdx = d.headers.indexOf('mes');
  const extra = name === 'Vendas' ? salesExtra : name === 'Pessoas' ? ['turnover_desligamentos', 'absenteismo', 'horas_extras_pct', 'saldo_movimentacoes'] : ['giro_mensal', 'ruptura_skus', 'cmv_vendas', 'diferenca_cmv'];
  const rows = d.rows.map(r => [...r.map((v, i) => i === dateIdx ? new Date(`${v}-01T00:00:00Z`) : v), ...extra.map(() => null)]);
  const widths = [...d.headers, ...extra].map(h => ['mes', 'id', 'ano', 'trimestre'].includes(h) ? 13 : Math.min(24, Math.max(18, h.length + 2)));
  const s = frame(name, name === 'Vendas' ? 'Vendas por mês, canal e região' : `${name} por mês`, `${d.file} · NC-2026.1 · ${rows.length} registros fictícios · colunas finais calculadas`, [...d.headers, ...extra], rows, widths);
  const end = rows.length + 5;
  s.getRange(`${col(dateIdx)}6:${col(dateIdx)}${end}`).setNumberFormat('mmm yyyy');
  s.getRange(`${col(d.headers.length)}6:${col(d.headers.length + extra.length - 1)}${end}`).format.fill = '#EEF3F8';
  s.getRange(`${col(name === 'Vendas' ? 4 : 2)}6:${col(d.headers.length - 1)}${end}`).setNumberFormat(integer);
}
const salesFormulas = {
  T: '=YEAR(A6)', U: '=ROUNDUP(MONTH(A6)/3,0)', V: '=I6-J6', W: `=${ratio('V6', 'I6')}`,
  X: '=I6-J6-K6-L6-M6', Y: `=${ratio('X6', 'I6')}`, Z: `=${ratio('F6', 'E6')}`,
  AA: `=${ratio('M6', 'N6')}`, AB: `=${ratio('O6', 'E6')}`, AC: `=${ratio('P6', 'E6')}`,
  AD: `=${ratio('(R6-S6)', 'Q6', '100*')}`, AE: `=${ratio('G6', 'F6')}`, AF: '=ROUND(I6-(F6-G6-H6),2)',
};
for (const [c, f] of Object.entries(salesFormulas)) formulaColumn('Vendas', c, f, 437);
formatColumns('Vendas', ['F','G','H','I','J','K','L','M','V','X','Z','AA','AF'], money, 437);
formatColumns('Vendas', ['W','Y','AB','AC','AE'], percent, 437);
formatColumns('Vendas', ['AD'], '0.0', 437);
for (const [c, f] of Object.entries({ J: `=${ratio('E6','C6')}`, K: `=${ratio('G6','F6')}`, L: `=${ratio('H6','F6')}`, M: '=D6-E6' })) formulaColumn('Pessoas', c, f, 41);
formatColumns('Pessoas', ['I'], money, 41);
formatColumns('Pessoas', ['J','K','L'], percent, 41);
for (const [c, f] of Object.entries({ G: `=${ratio('C6','D6')}`, H: `=${ratio('F6','E6')}`, I: "=SUMIF('Vendas'!$A$6:$A$437,B6,'Vendas'!$J$6:$J$437)", J: '=ROUND(C6-I6,2)' })) formulaColumn('Estoque', c, f, 41);
formatColumns('Estoque', ['C','D','I','J'], money, 41);
formatColumns('Estoque', ['G'], '0.00"x"', 41);
formatColumns('Estoque', ['H'], percent, 41);

// All ratios in grouped views are ratios of totals, not means of row rates.
const metricHeaders = ['receita_bruta', 'pedidos', 'receita_liquida', 'cmv', 'contribuicao_valor', 'margem_bruta_pct', 'contribuicao_pct', 'ticket_bruto', 'cac_gerencial', 'taxa_atraso', 'nps', 'marketing_investimento', 'novos_clientes', 'pedidos_atrasados', 'respostas_nps', 'promotores_nps', 'detratores_nps', 'frete_custo', 'descontos', 'devolucoes_valor', 'devolucoes_pedidos'];
function grouped(name, dimensions, keys, sourceColumns) {
  const width = dimensions.length;
  const rows = keys.map(key => [...key, ...metricHeaders.map(() => null)]);
  const s = frame(name, name === 'Mensal' ? 'Evolução mensal' : `Comparativo por ${name === 'Canais' ? 'canal' : 'região'}`, 'NC-2026.1 · valores em reais · taxas recalculadas pelos totais do recorte', [...dimensions, ...metricHeaders], rows, [...dimensions.map(() => 17), ...metricHeaders.map(() => 23)]);
  const end = rows.length + 5;
  const criteria = sourceColumns.map((c, i) => `'Vendas'!$${c}$6:$${c}$437,${col(i)}6`).join(',');
  const sum = c => `SUMIFS('Vendas'!$${c}$6:$${c}$437,${criteria})`;
  const addr = i => `${col(width + i)}6`;
  const fs = [sum('F'), sum('E'), sum('I'), sum('J'), sum('X'), ratio(`(${addr(2)}-${addr(3)})`,addr(2)), ratio(addr(4),addr(2)), ratio(addr(0),addr(1)), ratio(addr(11),addr(12)), ratio(addr(13),addr(1)), ratio(`(${addr(15)}-${addr(16)})`,addr(14),'100*'), sum('M'), sum('N'), sum('O'), sum('Q'), sum('R'), sum('S'), sum('K'), sum('G'), sum('H'), sum('P')];
  fs.forEach((f, i) => formulaColumn(name, col(width+i), `=${f}`, end));
  formatColumns(name, [0,2,3,4,7,8,11,17,18,19].map(i=>col(width+i)), money, end);
  formatColumns(name, [1,12,13,14,15,16,20].map(i=>col(width+i)), integer, end);
  formatColumns(name, [5,6,9].map(i=>col(width+i)), percent, end);
  formatColumns(name, [col(width+10)], '0.0', end);
  return s;
}
grouped('Mensal', ['mes'], raw.Pessoas.rows.map(r => [new Date(`${r[1]}-01T00:00:00Z`)]), ['A']);
formatColumns('Mensal', ['A'], 'mmm yyyy', 41);
grouped('Canais', ['ano','canal'], [2023,2024,2025].flatMap(y=>['E-commerce','Lojas','B2B'].map(c=>[y,c])), ['T','B']);
grouped('Regioes', ['ano','regiao'], [2023,2024,2025].flatMap(y=>['Sudeste','Nordeste','Sul','Centro-Oeste'].map(r=>[y,r])), ['T','C']);

const summary = frame('Resumo', 'Núcleo Casa', 'NC-2026.1 · janeiro/2023 a dezembro/2025 · empresa e dados inteiramente fictícios', ['Ano','Receita bruta','Pedidos','Receita líquida','Contribuição','Margem bruta','Taxa de atraso','NPS'], [2023,2024,2025].map(y=>[y,null,null,null,null,null,null,null]), [33,23,16,23,23,20,20,16], { freeze: false, filter: false });
const sy = c => `SUMIF('Vendas'!$T$6:$T$437,$A6,'Vendas'!$${c}$6:$${c}$437)`;
for (const [c, f] of Object.entries({ B:`=${sy('F')}`, C:`=${sy('E')}`, D:`=${sy('I')}`, E:`=${sy('X')}`, F:`=${ratio(`(D6-${sy('J')})`,'D6')}`, G:`=${ratio(sy('O'),'C6')}`, H:`=${ratio(`(${sy('R')}-${sy('S')})`,sy('Q'),'100*')}` })) formulaColumn('Resumo',c,f,8);
formatColumns('Resumo',['B','D','E'],money,8); formatColumns('Resumo',['C'],integer,8); formatColumns('Resumo',['F','G'],percent,8); formatColumns('Resumo',['H'],'0.0',8);
summary.getRange('A11:D11').values = [['Conferência do slide 03','Calculado','Referência','Diferença']];
summary.getRange('A12:D16').values = [['Receita bruta',null,manifest.receita_bruta_total,null],['Pedidos',null,manifest.pedidos_total,null],['Registros de vendas',null,manifest.registros_mensais,null],['Meses de pessoas',null,36,null],['Meses de estoque',null,36,null]];
const checks = ["SUM('Vendas'!F6:F437)","SUM('Vendas'!E6:E437)","COUNTA('Vendas'!D6:D437)","COUNTA('Pessoas'!A6:A41)","COUNTA('Estoque'!A6:A41)"];
checks.forEach((f,i)=>{cell('Resumo',`B${12+i}`,`=${f}`,true);cell('Resumo',`D${12+i}`,`=ROUND(B${12+i}-C${12+i},2)`,true);});
summary.getRange('B12:D12').setNumberFormat(money);summary.getRange('B13:D16').setNumberFormat(integer);
summary.getRange('A11:D11').format = { fill: palette.pale, font: { bold: true, color: palette.ink }, rowHeight: 30 };
summary.getRange('D12:D16').conditionalFormats.add('cellIs',{operator:'notEqual',formula:0,format:{fill:'#FBE4E1',font:{color:'#9F2929'}}});
cell('Resumo','A18','Contribuição gerencial exclui folha e outros custos fixos. Não representa lucro líquido ou caixa.');
cell('Resumo','A19','Comparativos completos usam dezembro/2025. Para corte em 15/12/2025, use meses encerrados até novembro.');
summary.getRange('A18:H19').format.font = {name:font,size:10,color:palette.muted};
for (const [range,value] of [['J5','Ano'],['K5','Receita bruta'],['L5','Contribuição']]) cell('Resumo',range,value);
summary.getRange('J6:L8').formulas = [6,7,8].map(r=>[`=A${r}&""`,`=B${r}`,`=E${r}`]);
summary.getRange('J1:L8').format.columnWidth = 20;
summary.getRange('J5:L8').format.font = { name:font,size:11,color:palette.ink };
summary.getRange('K6:L8').setNumberFormat(money);
const chart = summary.charts.add('bar',summary.getRange('J5:L8'));
chart.title = 'Receita e contribuição por ano (R$ milhões)';chart.setPosition('A22','H37');
chart.titleTextStyle.typeface=font;chart.titleTextStyle.fontSize=14;
chart.legend={position:'bottom',textStyle:{typeface:font,fontSize:11}};
chart.xAxis={axisType:'textAxis',textStyle:{typeface:font,fontSize:11}};
chart.yAxis={numberFormatCode:'0.0,,',numberFormatSourceLinked:false,textStyle:{typeface:font,fontSize:11}};
chart.series.items[0].fill=palette.blue;chart.series.items[1].fill='#82A2B4';

const guideRows = [
 ['A empresa','Varejo omnicanal fictício: e-commerce, 12 lojas e B2B. Quatro regiões comerciais. Não há detalhamento individual das lojas.'],
 ['A base','NC-2026.1. Janeiro/2023 a dezembro/2025. Os valores históricos e os IDs são os mesmos dos CSVs.'],
 ['504 registros de origem','432 registros de vendas + 36 meses de pessoas + 36 meses de estoque. As visões consolidadas repetem agregações, não adicionam operações.'],
 ['Comece pelas fontes','Vendas, Pessoas e Estoque contêm os dados. Cabeçalhos correspondem ao CSV. Colunas finais em azul claro contêm fórmulas.'],
 ['Explore os dados','Use os filtros das tabelas. Mensal, Canais e Regioes comparam recortes fixos por fórmula. Os filtros de Vendas não alteram essas visões.'],
 ['Faça os exercícios','Exercicios relaciona as sete atividades da aula e desafios adicionais aos dados, prompts e critérios de conferência.'],
 ['Confira seus resultados','Resumo reconcilia o slide 03. Confira fórmulas e IDs após produzir sua análise. As taxas usam numeradores e denominadores do mesmo recorte.'],
 ['Simule decisões','Cenarios contém alocação de R$ 1,2 milhão e sensibilidade de contribuição. As células amarelas são hipóteses editáveis, sem promessa de retorno.'],
 ['Pedidos e clientes','41.820 é a quantidade de pedidos. novos_clientes é uma atribuição gerencial. Não há IDs de cliente, coortes, LTV ou recompra.'],
 ['Pessoas e estoque','Bases consolidadas por mês. Agregue vendas antes do cruzamento. Não multiplique folha ou estoque pelas 12 linhas de vendas do mês.'],
 ['Limites financeiros','Contribuição simplificada não é lucro líquido. Não há fluxo de caixa, datas de recebimento ou custos fixos completos.'],
 ['Limites operacionais','Não há transportadora, SKU individual, produtividade pessoal ou comprovação causal. Catálogo de 1.280 SKUs é atributo do cenário.'],
 ['Corte temporal','A reunião é simulada em 15/12/2025, mas a base contém dezembro completo para fins didáticos. Na decisão nessa data, filtre até novembro/2025.'],
 ['Contexto e fontes','Fontes preserva POL-01, LOG-01, CON-01 e PES-01. Dicionario explica unidades, agregação e fórmulas.'],
 ['Rastreabilidade','Cite nome do CSV ou aba, ID, competência e fórmula. A linha 6 da planilha corresponde ao primeiro registro do CSV.'],
 ['Uso com IA','Anexe o XLSX ou os CSVs com LEIA-ME.md, conforme o exercício e a ferramenta. Não alegue ter analisado arquivos não anexados.'],
];
const guide=frame('Leia-me','Conheça a Núcleo Casa','Dados para os exemplos e exercícios do workshop', ['Tema','Orientação'],guideRows,[28,118],{height:48,filter:false});
guide.getRange('A6:B21').format.wrapText=true;
guide.getRange('A6:A21').format.font.bold=true;

// Explicitly hypothetical, independent budget and sensitivity exercises.
const scenarios=frame('Cenarios','Cenários para o conselho','Q1 e Q2/2026 · premissas didáticas editáveis em amarelo · nenhuma alocação implica retorno garantido', ['Destinação','Cenário A','Cenário B','Cenário C','Critério a discutir'],[
 ['Logística',480000,600000,300000,'Atrasos e contribuição por canal'],['Aquisição',240000,180000,360000,'CAC gerencial e contribuição'],['Expansão B2B',240000,180000,360000,'Contribuição e capacidade operacional'],['Reserva',240000,240000,180000,'Gatilhos e incertezas da execução'],['Total',null,null,null,'Alocações + reserva'],['Orçamento hipotético',1200000,1200000,1200000,'Fonte: mandato CON-01'],['Diferença',null,null,null,'Deve ser zero'],
 ],[35,23,23,23,64],{freeze:false,filter:false,height:28});
scenarios.getRange('B6:D9').format.fill=palette.input;
scenarios.getRange('B6:D12').setNumberFormat(money);
for(const c of ['B','C','D']) {cell('Cenarios',`${c}10`,`=SUM(${c}6:${c}9)`,true);cell('Cenarios',`${c}12`,`=${c}11-${c}10`,true);}
scenarios.getRange('B6:D9').dataValidation={rule:{type:'decimal',operator:'greaterThanOrEqual',formula1:0}};
scenarios.getRange('B12:D12').conditionalFormats.add('cellIs',{operator:'notEqual',formula:0,format:{fill:'#FBE4E1',font:{color:'#9F2929'}}});
cell('Cenarios','A15','Sensibilidade da contribuição');
cell('Cenarios','A16','Base: jan–nov/2025. Mesma receita líquida e demais custos. Altere apenas as três premissas abaixo.');
scenarios.getRange('A18:E18').values=[['Indicador','Base histórica','Simulação A','Simulação B','Definição']];
const scenarioRows=[['Receita líquida',null,null,null,'Constante: não é uma previsão de receita'],['CMV',null,null,null,'Variação relativa ao CMV histórico'],['Frete',null,null,null,'Variação relativa ao custo histórico'],['Taxas de pagamento',null,null,null,'Constantes'],['Marketing',null,null,null,'Variação relativa ao investimento histórico'],['Contribuição',null,null,null,'Receita líquida − CMV − frete − taxas − marketing'],['Margem de contribuição',null,null,null,'Contribuição / receita líquida'],['Variação da contribuição',null,null,null,'Simulação menos base histórica']];
scenarios.getRange('A19:E26').values=scenarioRows;
scenarios.getRange('A29:E29').values=[['Premissa relativa','Referência','Simulação A','Simulação B','Interpretação']];
scenarios.getRange('A30:E32').values=[['Variação do CMV',0,-0.03,0.05,'−3% reduz o custo; +5% aumenta o custo'],['Variação do frete',0,-0.10,0.10,'Não pressupõe mudança de prazo ou volume'],['Variação de marketing',0,0.10,-0.10,'Não pressupõe mudança de clientes ou receita']];
scenarios.getRange('A35:B36').values=[['Início da base',new Date('2025-01-01T00:00:00Z')],['Fim da base',new Date('2025-11-01T00:00:00Z')]];
scenarios.getRange('B35:B36').setNumberFormat('mmm yyyy');
for (const [r,c] of [[19,'I'],[20,'J'],[21,'K'],[22,'L'],[23,'M']]) cell('Cenarios',`B${r}`,`=SUMIFS('Vendas'!$${c}$6:$${c}$437,'Vendas'!$A$6:$A$437,">="&$B$35,'Vendas'!$A$6:$A$437,"<="&$B$36)`,true);
for(const c of ['B','C','D']) {cell('Cenarios',`${c}24`,`=${c}19-SUM(${c}20:${c}23)`,true);cell('Cenarios',`${c}25`,`=${ratio(`${c}24`,`${c}19`)}`,true);cell('Cenarios',`${c}26`,`=${c}24-$B$24`,true);}
for(const c of ['C','D']) for(const [r,f] of [[19,'=$B19'],[20,`=$B20*(1+${c}30)`],[21,`=$B21*(1+${c}31)`],[22,'=$B22'],[23,`=$B23*(1+${c}32)`]]) cell('Cenarios',`${c}${r}`,f,true);
scenarios.getRange('B19:D26').setNumberFormat(money);scenarios.getRange('B25:D25').setNumberFormat(percent);
scenarios.getRange('B30:D32').setNumberFormat(percent);scenarios.getRange('C30:D32').format.fill=palette.input;
scenarios.getRange('C30:D32').dataValidation={rule:{type:'decimal',operator:'greaterThanOrEqual',formula1:-1}};
scenarios.getRange('A15:E36').format.font={name:font,size:11,color:palette.ink};
scenarios.getRange('A18:E36').format.rowHeight=30;
for(const r of [18,29]) scenarios.getRange(`A${r}:E${r}`).format={fill:palette.blue,font:{name:font,size:11,bold:true,color:'#FFFFFF'},rowHeight:30};
scenarios.getRange('E6:E36').format.wrapText=true;

const activitySources={baseline:'Vendas; Dicionario',auditoria:'Vendas; Pessoas; Estoque; Resumo',cadeira:'Vendas; Pessoas; Estoque; Canais; Regioes',revisao:'Vendas; Dicionario; tentativa inicial',dashboard:'Mensal; Canais; Resumo',conselho:'Cenarios; Fontes; análises por cadeira',plano:'Aprendizados e registros do participante'};
const activityPrompts={baseline:'Sem modelo de prompt',auditoria:'P04–P06',cadeira:'P07–P21',revisao:'P31–P32',dashboard:'P25–P27',conselho:'P28–P30',plano:'P33'};
const challenges=[
 ['D01','Crescimento e margem','CEO','Compare 2023, 2024 e 2025. Receita e contribuição cresceram na mesma proporção?','Resumo; Canais; Vendas','P07–P10','Mostre variação anual em R$ e %, e dois IDs por achado.'],
 ['D02','Mix de canais','CEO','Calcule a participação de cada canal na receita e na contribuição em 2025.','Canais; Vendas','P07–P09','As participações de cada indicador devem somar 100%.'],
 ['D03','Descontos e devoluções','CFO','Explique a ponte entre receita bruta e líquida por ano.','Vendas; Mensal','P10','Reconcilie bruta − descontos − devoluções = líquida.'],
 ['D04','Sensibilidade dos custos','CFO','Varie CMV, frete e marketing e compare o efeito na contribuição.','Cenarios; Vendas','P11','Separe valores históricos de hipóteses; confira manualmente uma simulação.'],
 ['D05','Atrasos no Sudeste','COO','Compare E-commerce/Sudeste em jan–ago e set–nov/2025 e com as demais regiões.','Vendas; Fontes LOG-01','P13–P15','Some atrasos e pedidos por período; não use média simples de taxas nem atribua causa.'],
 ['D06','Giro e ruptura','COO','Compare giro mensal e ruptura no início e fim da série.','Estoque; Mensal','P14','Confira o CMV de um mês. Não some saldos de estoque como fluxo.'],
 ['D07','CAC por canal','CMO','Calcule CAC anual por canal e compare com a contribuição.','Canais; Vendas','P16–P18','Marketing / novos_clientes no mesmo recorte. Não calcule retenção com pedidos.'],
 ['D08','NPS e serviço','CMO','Compare NPS e atrasos por canal entre 2024 e 2025.','Canais; Vendas','P16–P17','Use os totais de promotores, detratores e respostas; não afirme causalidade.'],
 ['D09','Capacidade de pessoas','CHRO','Compare absenteísmo, horas extras e turnover mensal com o volume de pedidos.','Pessoas; Mensal','P19–P21','Faça o cruzamento mês a mês, com uma linha por competência.'],
 ['D10','Sazonalidade','CEO','Compare novembro e dezembro com os outros meses em cada ano.','Mensal; Vendas','P07','Declare se o dado está disponível na data de decisão; dezembro é completo e didático.'],
 ['D11','Limites da evidência','RAG','Responda qual transportadora explica os atrasos e qual é a recompra.','Fontes; Dicionario; Vendas','P22–P24','Reconheça que ambas as respostas são indisponíveis e especifique os dados faltantes.'],
 ['D12','Alocação com reserva','Conselho','Compare três alocações e escolha uma com guardrail e revisão em 30 dias.','Cenarios; Fontes CON-01','P12; P28–P30','Alocações + reserva = R$ 1,2 milhão. Não prometa retorno calculável na base.'],
];
const exercises=frame('Exercicios','Exercícios com a base','Sete atividades da aula e 12 desafios adicionais · registre suas respostas na aplicação ou em um documento', ['ID','Atividade','Perspectiva','Pergunta ou tarefa','Abas e evidências','Prompts','Entrega e conferência'],[
 ...content.exercises.map(e=>[e.id,e.title,'Workshop',e.brief,activitySources[e.id],activityPrompts[e.id],`${e.deliverable}. ${e.tips}`]),...challenges
],[16,32,16,72,34,19,68],{height:106});
exercises.getRange('A6:G24').format.wrapText=true;
exercises.getRange('A6:G24').format.verticalAlignment='top';

const definitions={
 mes:['mês','Competência mensal. Não é data de recebimento.','Chave para cruzar bases após consolidar vendas.'],canal:['texto','E-commerce, Lojas ou B2B.','Dimensão. Lojas reúne as 12 unidades do cenário.'],regiao:['texto','Sudeste, Nordeste, Sul ou Centro-Oeste.','Dimensão comercial. Não há região Norte na base.'],id:['texto','Identificador estável do registro de origem.','Não somar. Cite o ID para rastrear a evidência.'],pedidos:['pedidos','Quantidade de pedidos no recorte.','Somar. Não equivale a clientes únicos.'],receita_bruta:['R$','Receita antes de descontos e devoluções.','Somar. Total da base: R$ 48.600.000.'],descontos:['R$','Descontos comerciais concedidos.','Somar. Taxa = descontos / receita_bruta.'],devolucoes_valor:['R$','Valor monetário das devoluções.','Somar. Não confundir com quantidade de pedidos devolvidos.'],receita_liquida:['R$','receita_bruta − descontos − devolucoes_valor.','Somar. Definição gerencial da simulação.'],cmv:['R$','Custo das mercadorias vendidas.','Somar. Reconciliar por mês com cmv_mes do estoque.'],frete_custo:['R$','Custo de frete do recorte.','Somar. Não identifica transportadora.'],taxas_pagamento:['R$','Custos dos meios de pagamento.','Somar. Não corresponde a todos os tributos.'],marketing_investimento:['R$','Investimento de marketing atribuído ao recorte.','Somar. Não comprova causalidade de vendas.'],novos_clientes:['clientes atribuídos','Novos clientes atribuídos a uma linha.','Somar para CAC gerencial. Não existe histórico por cliente.'],pedidos_atrasados:['pedidos','Pedidos classificados como atrasados.','Somar. Dividir pelo total de pedidos no mesmo recorte.'],devolucoes_pedidos:['pedidos','Pedidos devolvidos.','Somar. Dividir por pedidos, não por receita.'],respostas_nps:['respostas','Quantidade de respostas à pesquisa.','Somar. Denominador do NPS.'],promotores_nps:['respostas','Quantidade de promotores na amostra.','Somar. Não exceder respostas com detratores.'],detratores_nps:['respostas','Quantidade de detratores na amostra.','Somar. Neutros = respostas − promotores − detratores.'],headcount_medio:['pessoas','Quantidade média de pessoas no mês.','Média para recortes de vários meses; não somar como quadro único.'],admissoes:['movimentações','Admissões no mês.','Somar. Headcount médio não é saldo final para reconciliar movimentos.'],desligamentos:['movimentações','Desligamentos no mês.','Somar. Taxa mensal = desligamentos / headcount_medio.'],horas_previstas:['horas','Horas previstas no mês.','Somar. Denominador de absenteísmo e horas extras.'],horas_ausencia:['horas','Horas de ausência agregadas.','Somar. Não atribuir saúde ou conduta individual.'],horas_extras:['horas','Horas extras agregadas.','Somar. Não é custo monetário de horas extras.'],folha_total:['R$','Folha consolidada da empresa por mês.','Somar meses uma vez. Não replicar por canal ou região.'],cmv_mes:['R$','CMV consolidado da empresa no mês.','Somar. Igual ao total mensal de cmv em Vendas.'],estoque_medio_custo:['R$','Estoque médio do mês avaliado ao custo.','Saldo médio: não somar ao longo do tempo como fluxo.'],skus_catalogo:['SKUs','Tamanho do catálogo no mês.','1.280 no cenário. Não somar meses como produtos distintos.'],skus_sem_estoque:['SKUs','Quantidade de SKUs sem estoque no mês.','Taxa mensal = skus_sem_estoque / skus_catalogo.'],
};
const dictionaryRows=[];
for(const name of ['Vendas','Pessoas','Estoque']) for(const h of raw[name].headers) {assert(definitions[h],h); const [unit,meaning,rule]=definitions[h];dictionaryRows.push([name,h,unit,meaning,rule]);}
const calculated=[
 ['Vendas','ano / trimestre','inteiro','Ano e trimestre extraídos de mes.','Dimensões para agrupar.'],
 ['Vendas','margem_bruta_valor / pct','R$ / %','receita_liquida − cmv; valor / receita_liquida.','Recalcular percentual pelos totais.'],
 ['Vendas','contribuicao_valor / pct','R$ / %','receita_liquida − cmv − frete_custo − taxas_pagamento − marketing_investimento.','Percentual = contribuição / receita líquida. Não é lucro líquido.'],
 ['Vendas','ticket_bruto','R$/pedido','receita_bruta / pedidos.','Receita total / pedidos totais do recorte.'],
 ['Vendas','cac_gerencial','R$/cliente atribuído','marketing_investimento / novos_clientes.','Totais do mesmo recorte. Não é ROAS nem LTV.'],
 ['Vendas','taxa_atraso / taxa_devolucao','%','pedidos_atrasados / pedidos; devolucoes_pedidos / pedidos.','Recalcular pelos totais.'],
 ['Vendas','nps','pontos de −100 a 100','100 × (promotores_nps − detratores_nps) / respostas_nps.','Não formatar como percentual; não usar média de NPS.'],
 ['Vendas','taxa_desconto','%','descontos / receita_bruta.','Recalcular pelos totais.'],
 ['Vendas','conferencia_receita','R$','receita_liquida − (receita_bruta − descontos − devolucoes_valor).','Zero indica reconciliação monetária por linha.'],
 ['Pessoas','turnover_desligamentos','% mensal','desligamentos / headcount_medio.','Para período anual, declarar a convenção; não somar taxas mensais.'],
 ['Pessoas','absenteismo / horas_extras_pct','%','horas_ausencia / horas_previstas; horas_extras / horas_previstas.','Recalcular com horas totais.'],
 ['Pessoas','saldo_movimentacoes','pessoas','admissoes − desligamentos.','Não reconcilia sozinho headcount médio ou saldo final.'],
 ['Estoque','giro_mensal','vezes/mês','cmv_mes / estoque_medio_custo.','Não anualizar sem premissa.'],
 ['Estoque','ruptura_skus','% mensal','skus_sem_estoque / skus_catalogo.','Não representa perda de vendas ou disponibilidade por pedido.'],
 ['Estoque','cmv_vendas / diferenca_cmv','R$','Somatório mensal de cmv em Vendas; cmv_mes − cmv_vendas.','Diferença deve ser zero.'],
 ['Todas','Denominador zero','sem resultado','Fórmulas de divisão retornam célula vazia se o denominador for zero.','Vazio significa indicador indisponível, não resultado zero.'],
 ['Mensal; Canais; Regioes','Agregações','mesmas unidades','Totais agrupados a partir de Vendas. Taxas = numerador total / denominador total.','São visões derivadas. Não somar com os dados de origem.'],
 ['Cenarios','Premissas e alocações','R$ / variação %','Valores em amarelo são exemplos hipotéticos editáveis.','Não são novos registros históricos ou previsões validadas.'],
];
const dictionary=frame('Dicionario','Dicionário de dados e indicadores','Unidades, definições e regras de agregação · nomes originais mantidos para uso com os prompts', ['Aba','Campo','Unidade','Definição ou fórmula','Como agregar e interpretar'],[...dictionaryRows,...calculated],[22,38,23,78,78],{height:58});
dictionary.getRange(`A6:E${dictionaryRows.length+calculated.length+5}`).format.wrapText=true;

const documents=(await fs.readFile(path.join(root,'resources/dados/politicas-e-eventos.md'),'utf8')).split('\n## ').slice(1).map(section=>{const [heading,...body]=section.split('\n');return [heading.split(' | ')[0],heading.split(' | ').slice(1).join(' · '),'politicas-e-eventos.md',body.join(' ').trim()];});
const sources=frame('Fontes','Fontes do caso','Documentos e bases sintéticos fornecidos no workshop · nenhum dado de uma empresa real', ['ID ou arquivo','Conteúdo','Fonte','Descrição'],[
 ...documents,
 ['NC-VENDAS','432 linhas, M-0001 a M-0432','nucleo-casa-mensal.csv','Vendas por mês, canal e região. IDs originais preservados na aba Vendas.'],
 ['NC-PESSOAS','36 linhas, P-001 a P-036','pessoas-mensal.csv','Pessoas agregadas por competência. Sem dados individuais.'],
 ['NC-ESTOQUE','36 linhas, E-001 a E-036','estoque-mensal.csv','Estoque mensal ao custo e CMV reconciliado com Vendas.'],
 ['NC-DICIONARIO','Universo, fórmulas e limites','LEIA-ME.md','Fonte das definições. O orçamento de R$ 1,2 milhão é hipotético.'],
 ['NC-CONTROLE','Totais e versão','resumo.json','Receita bruta R$ 48.600.000; 41.820 pedidos; 432 registros; NC-2026.1; seed 602026.'],
 ['NC-AULA','Slide 03, sete atividades e 33 prompts','content.json','Origem do contexto e dos exercícios da aula. D01 a D12 são desafios complementares desta planilha.'],
 ['NC-CORTE','Corte temporal da simulação','Nota didática desta planilha','Dezembro/2025 completo é material retrospectivo. Não trate esse mês como encerrado em 15/12/2025. Cenarios usa janeiro a novembro/2025.'],
],[25,50,32,112],{height:82});
sources.getRange('A6:D16').format.wrapText=true;

// Compact verification of formulas, source fidelity and editable dependencies.
const expectedContribution=raw.Vendas.rows.reduce((sum,r)=>sum+r[8]-r[9]-r[10]-r[11]-r[12],0);
const close=(actual,expected,label)=>assert(Math.abs(actual-expected)<0.011,`${label}: ${actual} != ${expected}`);
close(summary.getRange('B12').values[0][0],48600000,'gross');
assert.equal(summary.getRange('B13').values[0][0],41820);
close(summary.getRange('E6:E8').values.flat().reduce((a,b)=>a+b,0),expectedContribution,'contribution');
assert(summary.getRange('D12:D16').values.every(r=>r[0]===0));
assert(sheets.Estoque.getRange('J6:J41').values.every(r=>r[0]===0));
assert(sheets.Vendas.getRange('AF6:AF437').values.every(r=>r[0]===0));
assert(scenarios.getRange('B12:D12').values.flat().every(v=>v===0));
const original=scenarios.getRange('C24').values[0][0];
const cmv=scenarios.getRange('B20').values[0][0];
cell('Cenarios','C30',-0.02);close(scenarios.getRange('C24').values[0][0],original-cmv*0.01,'sensitivity change');cell('Cenarios','C30',-0.03);
cell('Cenarios','B6',480001);assert.equal(scenarios.getRange('B12').values[0][0],-1);cell('Cenarios','B6',480000);
console.log((await wb.inspect({kind:'table',range:'Resumo!A5:H8',include:'values,formulas',tableMaxRows:4,tableMaxCols:8,maxChars:3500})).ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},summary:'Formula error scan',maxChars:3500});
console.log(errors.ndjson);
const views={ 'Leia-me':'A1:B11',Resumo:'A1:H37',Vendas:'A1:J12',Pessoas:'A1:M12',Estoque:'A1:J12',Mensal:'A1:H12',Canais:'A1:I14',Regioes:'A1:I17',Cenarios:'A1:E36',Exercicios:'A1:G8',Dicionario:'A1:E10',Fontes:'A1:D9' };
for(const [name,range] of Object.entries(views)) {
  const preview=await wb.render({sheetName:name,range,scale:1,format:'png'});
  await fs.writeFile(path.join(scratch,`${name}.png`),new Uint8Array(await preview.arrayBuffer()));
}
const destination=path.join(root,'resources/dados/nucleo-casa-exercicios.xlsx');
const output=await SpreadsheetFile.exportXlsx(wb);
const exported=path.join(scratch,'nucleo-casa-exercicios.xlsx');
await output.save(exported);
await fs.copyFile(exported,destination);
console.log(JSON.stringify({output:destination,previews:scratch,sheets:names.length,sourceRecords:504,exercises:19,verified:true}));
