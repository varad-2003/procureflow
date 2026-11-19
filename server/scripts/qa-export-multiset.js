import fs from 'node:fs/promises';
import Papa from 'papaparse';
import { spawn } from 'node:child_process';

const server = spawn(process.execPath, ['src/app.js'], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: '' },
  stdio: ['ignore', 'pipe', 'pipe']
});

await new Promise((resolve) => setTimeout(resolve, 15000));
const api = 'http://localhost:4000/api';
let response = await fetch(api + '/auth/register', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'QA', email: 'qamultiset@corvo.test', password: 'qa123', role: 'ADMIN' })
});
const auth = await response.json();
const headers = { authorization: 'Bearer ' + auth.token, 'content-type': 'application/json' };
for (const [dataset, file] of [
  ['items', 'master_data/item_master.csv'],
  ['suppliers', 'master_data/supplier_master.csv'],
  ['plants', 'master_data/plants.csv'],
  ['history', 'master_data/po_history.csv'],
  ['contracts', 'contracts/contract_register.csv'],
  ['contractLines', 'contracts/contract_lines.csv']
]) {
  const csv = await fs.readFile('../Cantill_FullStack_Task_Kit/' + file, 'utf8');
  await fetch(api + '/admin/import-master-data', {
    method: 'POST',
    headers,
    body: JSON.stringify({ dataset, csv })
  });
}
const csv = await fs.readFile('../Cantill_FullStack_Task_Kit/pr_batches/sample_pr_batch.csv', 'utf8');
await fetch(api + '/process-batch', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ csv })
});
const input = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
const text = await (await fetch(api + '/export/decisions')).text();
const output = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
server.kill('SIGTERM');

const inputCount = new Map();
const outputCount = new Map();
for (const row of input) {
  const key = row.pr_no + '/' + row.pr_line;
  inputCount.set(key, (inputCount.get(key) || 0) + 1);
}
for (const row of output) {
  const key = row.pr_no + '/' + row.pr_line;
  outputCount.set(key, (outputCount.get(key) || 0) + 1);
}
const missing = [];
const extra = [];
for (const [key, count] of inputCount) {
  if (outputCount.get(key) !== count) missing.push({ key, input: count, output: outputCount.get(key) || 0 });
}
for (const [key, count] of outputCount) {
  if (inputCount.get(key) !== count) extra.push({ key, input: inputCount.get(key) || 0, output: count });
}
console.log(JSON.stringify({ inputRows: input.length, outputRows: output.length, missingCount: missing.length, extraCount: extra.length, missing: missing.slice(0, 10), extra: extra.slice(0, 10) }));
