import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pdfParse from 'pdf-parse';
import { env } from './config/env.js';
import { connectDatabase, pingDatabase } from './db.js';
import { parseCsv, decisionsCsv } from './services/csv.js';
import { processBatch } from './services/procurement/engine.js';
import { policyV5 } from './services/policy/defaultPolicy.js';
import { evaluatePolicy, validatePolicy } from './services/policy/evaluator.js';
import { testGeminiConnectivity } from './services/ai/gemini.js';
import { extractPurchaseRequest } from './services/ai/gemini.js';
import { parseContractPdfText } from './services/contracts/pdfContract.js';
import { PurchaseRequest, Requirement, PurchaseOrder, Decision, Policy, Contract, AuditLog, ChatSession, BatchRun } from './models/index.js';

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });
app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: '2mb' }));

const state = { users: [], items: [], suppliers: [], plants: [], history: [], contracts: [], policies: [policyV5], decisions: [], batches: new Map(), chats: new Map() };
const sign = (user) => jwt.sign({ id: user.email, role: user.role, name: user.name }, env.jwtSecret, { expiresIn: '8h' });
function auth(required = false) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    try { req.user = token ? jwt.verify(token, env.jwtSecret) : null; } catch { if (required) return res.status(401).json({ error: 'Invalid authentication token' }); }
    if (required && !req.user) return res.status(401).json({ error: 'Authentication required' });
    next();
  };
}
const toNumber = (value) => value === '' || value === undefined ? undefined : Number(value);
function mapData(dataset, rows) {
  const mappings = {
    items: (r) => ({ itemCode: r.item_code, description: r.description, uom: r.uom, category: r.category, itemType: r.item_type, standardPrice: toNumber(r.standard_price) }),
    suppliers: (r) => ({ supplierId: r.supplier_id, name: r.name, city: r.city, categories: String(r.categories || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean), status: r.status, onTimePct: toNumber(r.on_time_pct) || 0, qualityRating: toNumber(r.quality_rating) || 0 }),
    plants: (r) => ({ code: r.plant, name: r.name }),
    history: (r) => ({ poNumber: r.po_number, poDate: r.po_date, supplierId: r.supplier_id, itemCode: r.item_code, quantity: toNumber(r.quantity), unitPrice: toNumber(r.unit_price), plant: r.plant, deliveredOnTime: r.delivered_on_time === 'True' }),
    contracts: (r) => ({ contractId: r.contract_id, supplierId: r.supplier_id, supplierName: r.supplier_name, startDate: r.start_date, endDate: r.end_date, valueCap: toNumber(r.value_cap), consumedValue: toNumber(r.consumed_value) || 0, source: 'register', lines: [] })
  };
  if (dataset === 'contractLines') {
    for (const row of rows) {
      const contract = state.contracts.find((entry) => entry.contractId === row.contract_id);
      if (contract) contract.lines.push({ itemCode: row.item_code, description: row.description, uom: row.uom, rate: toNumber(row.rate) });
    }
    return;
  }
  if (!mappings[dataset]) throw new Error(`Unknown dataset: ${dataset}`);
  if (dataset === 'contracts') {
    const pdfContracts = state.contracts.filter((contract) => contract.source === 'signed-pdf');
    const registerContracts = rows.map(mappings.contracts);
    const registerIds = new Set(registerContracts.map((contract) => contract.contractId));
    state.contracts = [...registerContracts, ...pdfContracts.filter((contract) => !registerIds.has(contract.contractId))];
  } else {
    state[dataset] = rows.map(mappings[dataset]);
  }
}
function activePolicy(date = new Date()) {
  return [...state.policies].filter((p) => p.status === 'ACTIVE' && new Date(p.effectiveDate) <= new Date(date)).sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate))[0] || policyV5;
}

app.get('/api/health', async (req, res) => {
  try {
    const database = await pingDatabase();
    res.status(database.connected && database.pinged ? 200 : 503).json({
      ok: database.connected && database.pinged,
      service: 'procureflow',
      database: {
        connected: database.connected,
        pinged: database.pinged
      }
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: 'procureflow',
      database: { connected: false, pinged: false }
    });
  }
});
app.get('/api/health/gemini', async (req, res) => {
  try {
    await testGeminiConnectivity();
    res.json({ ok: true, gemini: { connected: true } });
  } catch (error) {
    res.status(503).json({ ok: false, gemini: { connected: false } });
  }
});
app.post('/api/auth/register', async (req, res, next) => { try { const { name, email, password, role = 'EMPLOYEE' } = req.body; if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' }); if (state.users.some((u) => u.email === email)) return res.status(409).json({ error: 'Email already registered' }); const user = { name, email, role, passwordHash: await bcrypt.hash(password, 10) }; state.users.push(user); res.status(201).json({ token: sign(user), user: { name, email, role } }); } catch (e) { next(e); } });
app.post('/api/auth/login', async (req, res, next) => { try { const user = state.users.find((u) => u.email === req.body.email); if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' }); res.json({ token: sign(user), user: { name: user.name, email: user.email, role: user.role } }); } catch (e) { next(e); } });
app.get('/api/auth/me', auth(true), (req, res) => res.json({ user: req.user }));

app.post('/api/admin/import-master-data', auth(true), upload.single('file'), async (req, res, next) => { try { const text = req.file ? await fs.readFile(req.file.path, 'utf8') : req.body.csv; const rows = parseCsv(text); mapData(req.body.dataset, rows); const imported = req.body.dataset === 'contractLines' ? rows.length : state[req.body.dataset]?.length || 0; res.json({ imported, dataset: req.body.dataset }); } catch (e) { next(e); } });
app.post('/api/pr/upload', auth(false), upload.single('file'), async (req, res, next) => { try { const text = req.file ? await fs.readFile(req.file.path, 'utf8') : req.body.csv; const rows = parseCsv(text); res.status(201).json({ accepted: rows.length, rows }); } catch (e) { next(e); } });
app.get('/api/pr', auth(false), (req, res) => res.json([...state.batches.values()].flatMap((batch) => batch.groups.flatMap((group) => group.lines))));
app.post('/api/process-batch', auth(false), upload.single('file'), async (req, res, next) => { try { const text = req.file ? await fs.readFile(req.file.path, 'utf8') : req.body.csv; if (!text) return res.status(400).json({ error: 'CSV file or csv body is required' }); const raw = parseCsv(text); const lines = raw.map((r) => ({ ...r, prNo: r.pr_no, prLine: Number(r.pr_line), quantity: Number(r.quantity), estimatedUnitPrice: toNumber(r.estimated_unit_price), createdAt: r.created_at, needByDate: r.need_by_date }));
  const effectivePolicy = activePolicy(lines[0]?.createdAt);
  const batchHash = crypto.createHash('sha256').update(text).update(`|${effectivePolicy.version}`).digest('hex');
  const stableBatchId = `BATCH-${batchHash.slice(0, 16)}`;
  const existingRun = await BatchRun.findOne({ batchHash }).lean().catch(() => null);
  if (existingRun?.resultSnapshot) {
    state.batches.set(stableBatchId, existingRun.resultSnapshot);
    state.decisions = existingRun.resultSnapshot.decisions;
    return res.json({
      batchId: existingRun.batchId,
      lineCount: existingRun.lineCount,
      groupCount: existingRun.groupCount,
      decisions: existingRun.resultSnapshot.decisions,
      replayed: true
    });
  }
  const batchId = stableBatchId;
  const result = processBatch({ lines, items: state.items, suppliers: state.suppliers, history: state.history, contracts: state.contracts, policy: effectivePolicy, policyResolver: activePolicy });
  state.batches.set(batchId, result);
  state.decisions = result.decisions;
  for (const line of lines) {
    await PurchaseRequest.updateOne(
      { batchId, prNo: line.prNo, prLine: line.prLine },
      { $set: { batchId, prNo: line.prNo, prLine: line.prLine, createdAt: new Date(line.createdAt), requester: line.requester, department: line.department, plant: line.plant, itemCode: line.itemCode || line.item_code, description: line.description, quantity: line.quantity, uom: line.uom, estimatedUnitPrice: line.estimatedUnitPrice, needByDate: new Date(line.needByDate), urgency: line.urgency, original: line } },
      { upsert: true }
    ).catch(() => {});
  }
  for (const decision of result.decisions) {
    await Decision.updateOne(
      { groupId: decision.groupId, policyVersion: decision.policyVersion },
      { $set: decision },
      { upsert: true }
    ).catch(() => {});
  }
  for (const group of result.groups) {
    await Requirement.updateOne(
      { groupId: group.groupId },
      { $set: {
        groupId: group.groupId,
        resolvedItemCode: group.lines[0]?.resolvedItemCode,
        plant: group.lines[0]?.plant,
        requirementDate: new Date(group.lines[0]?.createdAt),
        quantity: group.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
        urgency: group.lines.some((line) => String(line.urgency).toLowerCase() === 'emergency') ? 'Emergency' : 'Normal'
      } },
      { upsert: true }
    ).catch(() => {});
  }
  for (const contract of state.contracts) {
    await Contract.updateOne(
      { contractId: contract.contractId },
      { $set: { consumedValue: contract.consumedValue || 0 } }
    ).catch(() => {});
  }
  for (const poId of new Set(result.decisions.map((decision) => decision.poId).filter(Boolean))) {
    const poDecisions = result.decisions.filter((decision) => decision.poId === poId);
    await PurchaseOrder.updateOne(
      { poId },
      { $set: {
        poId,
        supplierId: poDecisions[0].supplierId,
        plant: poDecisions[0].plant,
        route: poDecisions[0].route,
        requirementIds: poDecisions.map((decision) => decision.groupId),
        value: poDecisions.reduce((sum, decision) => sum + decision.groupValueInr, 0),
        status: 'DRAFT'
      } },
      { upsert: true }
    ).catch(() => {});
  }
  await BatchRun.updateOne(
    { batchHash },
    {
      $set: {
        batchHash,
        batchId,
        policyVersion: effectivePolicy.version,
        lineCount: lines.length,
        groupCount: result.groups.length,
        resultSnapshot: { groups: result.groups, decisions: result.decisions }
      }
    },
    { upsert: true }
  ).catch(() => {});
  res.json({ batchId, lineCount: lines.length, groupCount: result.groups.length, decisions: result.decisions }); } catch (e) { next(e); } });
app.get('/api/export/decisions', auth(false), (req, res) => { res.type('text/csv').attachment('decisions.csv').send(decisionsCsv(state.decisions)); });
app.get('/api/decisions', auth(false), (req, res) => res.json(state.decisions));
app.get('/api/decisions/:id', auth(false), (req, res) => { const found = state.decisions.find((d) => d.groupId === req.params.id); if (!found) return res.status(404).json({ error: 'Decision not found' }); res.json(found); });
app.post('/api/decisions/:id/approve', auth(true), (req, res) => { const found = state.decisions.find((d) => d.groupId === req.params.id); if (!found) return res.status(404).json({ error: 'Decision not found' }); found.status = 'APPROVED'; found.approvedBy = req.user.id; found.approvedAt = new Date().toISOString(); res.json(found); });
app.post('/api/decisions/:id/override', auth(true), (req, res) => { const found = state.decisions.find((d) => d.groupId === req.params.id); if (!found || !req.body.reason) return res.status(400).json({ error: 'Decision and written reason are required' }); found.overrideHistory = [...(found.overrideHistory || []), { ...req.body, user: req.user.id, at: new Date().toISOString() }]; found.decision = req.body.decision || found.decision; found.route = req.body.route || found.route; res.json(found); });
app.get('/api/policies', auth(false), (req, res) => res.json(state.policies));
app.post('/api/policies/upload', auth(true), upload.single('file'), async (req, res, next) => { try { const text = req.file ? await fs.readFile(req.file.path, 'utf8') : req.body.policy; const draft = typeof text === 'string' ? JSON.parse(text) : text; validatePolicy(draft); draft.status = 'DRAFT'; state.policies.push(draft); await Policy.updateOne({ policyId: draft.policyId, version: draft.version }, { $set: draft }, { upsert: true }).catch(() => {}); res.status(201).json(draft); } catch (e) { next(e); } });
app.post('/api/policies/:id/approve', auth(true), async (req, res) => { const policy = state.policies.find((p) => p.version === req.params.id); if (!policy) return res.status(404).json({ error: 'Policy not found' }); state.policies.forEach((p) => { if (p.status === 'ACTIVE') p.status = 'SUPERSEDED'; }); policy.status = 'ACTIVE'; policy.approvedBy = req.user.id; await Policy.updateMany({ status: 'ACTIVE' }, { $set: { status: 'SUPERSEDED' } }).catch(() => {}); await Policy.updateOne({ policyId: policy.policyId, version: policy.version }, { $set: policy }, { upsert: true }).catch(() => {}); res.json(policy); });
app.post('/api/policies/amend', auth(true), (req, res, next) => { try { const draft = { ...req.body, status: 'DRAFT', uploadDate: new Date().toISOString() }; validatePolicy(draft); state.policies.push(draft); Policy.updateOne({ policyId: draft.policyId, version: draft.version }, { $set: draft }, { upsert: true }).catch(() => {}); res.status(201).json(draft); } catch (e) { next(e); } });
app.get('/api/policies/:id/diff', auth(false), (req, res) => { const index = state.policies.findIndex((p) => p.version === req.params.id); if (index < 1) return res.status(404).json({ error: 'No previous policy available' }); res.json({ from: state.policies[index - 1], to: state.policies[index] }); });
app.get('/api/suppliers', auth(false), (req, res) => res.json(state.suppliers));
app.get('/api/suppliers/preferred', auth(false), (req, res) => res.json(state.suppliers.filter((supplier) => supplier.status === 'Active')));
app.get('/api/export/suppliers', auth(false), (req, res) => { const rows = state.suppliers.filter((supplier) => supplier.status === 'Active').map((supplier, index) => ({ item_code: req.query.itemCode || '', rank: index + 1, supplier_id: supplier.supplierId, reference_price: '', top_3: '' })); res.type('text/csv').send((rows.length ? Object.keys(rows[0]).join(',') + '\n' + rows.map((row) => Object.values(row).join(',')).join('\n') : 'item_code,rank,supplier_id,reference_price,top_3')); });
app.get('/api/contracts', auth(false), (req, res) => res.json(state.contracts));
app.post('/api/contracts/upload-pdf', auth(true), upload.single('file'), async (req, res, next) => { try { if (!req.file) return res.status(400).json({ error: 'PDF file is required' }); const buffer = await fs.readFile(req.file.path); const extracted = await pdfParse(buffer); const contract = parseContractPdfText(extracted.text, req.file.originalname); contract.verified = false; const existingIndex = state.contracts.findIndex((item) => item.contractId === contract.contractId); if (existingIndex >= 0) state.contracts[existingIndex] = contract; else state.contracts.push(contract); res.status(201).json({ contract, requiresBuyerVerification: true }); } catch (e) { next(e); } });
app.post('/api/contracts', auth(true), (req, res) => { if (!req.body.contractId) return res.status(400).json({ error: 'contractId is required' }); const contract = { ...req.body, source: 'manual', verified: true, lines: req.body.lines || [] }; state.contracts.push(contract); res.status(201).json(contract); });
app.post('/api/chat', auth(false), async (req, res) => {
  const id = req.body.sessionId || `CHAT-${Date.now()}`;
  const messages = state.chats.get(id) || [];
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'message is required' });
  messages.push({ role: 'user', content: message, createdAt: new Date().toISOString() });
  try {
    const result = await extractPurchaseRequest(message);
    const extracted = result.extracted || {};
    const missing = ['item', 'quantity', 'plant', 'needByDate', 'urgency'].filter((key) => extracted[key] === null || extracted[key] === undefined || extracted[key] === '');
    const followUp = missing.length
      ? `Please provide: ${missing.map((key) => ({ item: 'item', quantity: 'quantity', plant: 'plant', needByDate: 'need-by date', urgency: 'urgency' }[key])).join(', ')}.`
      : 'Please confirm the purchase request before it is created.';
    messages.push({ role: 'assistant', content: followUp, createdAt: new Date().toISOString() });
    state.chats.set(id, messages);
    await ChatSession.updateOne(
      { sessionId: id },
      { $set: { sessionId: id, messages, draft: extracted } },
      { upsert: true }
    ).catch(() => {});
    res.json({ sessionId: id, messages, extracted, missing, model: result.model });
  } catch (error) {
    const followUp = 'The assistant could not interpret that message. Please rephrase and include item, quantity, plant, need-by date and urgency.';
    messages.push({ role: 'assistant', content: followUp, createdAt: new Date().toISOString() });
    state.chats.set(id, messages);
    res.status(503).json({ sessionId: id, messages, extracted: null, fallback: true, error: 'Gemini extraction unavailable' });
  }
});
app.get('/api/chat/:sessionId', auth(false), (req, res) => res.json({ sessionId: req.params.sessionId, messages: state.chats.get(req.params.sessionId) || [] }));

app.use((error, req, res, next) => { console.error(error); res.status(error.status || 500).json({ error: error.message || 'Internal server error' }); });
async function startServer() {
  if (!env.mongoUri) {
    console.error('Startup aborted: MONGODB_URI is not configured.');
    process.exitCode = 1;
    return;
  }
  try {
    await connectDatabase();
  } catch (error) {
    const code = error?.codeName || error?.name || 'MongoDB connection error';
    console.error(`Startup aborted: MongoDB connection failed (${code}). Check MONGODB_URI, Atlas network access and database credentials.`);
    process.exitCode = 1;
    return;
  }
  try {
    const persistedPolicies = await Policy.find({}).lean();
    if (!persistedPolicies.some((policy) => policy.version === '5.0')) {
      await Policy.updateOne(
        { policyId: policyV5.policyId, version: '5.0' },
        { $set: policyV5 },
        { upsert: true }
      );
    }
    const hydratedPolicies = await Policy.find({}).lean();
    if (hydratedPolicies.length) {
      state.policies = hydratedPolicies.map((policy) => ({
        policyId: policy.policyId,
        version: policy.version,
        effectiveDate: policy.effectiveDate,
        status: policy.status,
        rules: policy.rules,
        sourceDocument: policy.sourceDocument,
        changeSummary: policy.changeSummary
      }));
      const effectiveActive = [...hydratedPolicies]
        .filter((policy) => policy.status === 'ACTIVE')
        .sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate))[0];
      if (effectiveActive) {
        await Policy.updateMany(
          { _id: { $ne: effectiveActive._id }, status: 'ACTIVE' },
          { $set: { status: 'SUPERSEDED' } }
        );
        state.policies = state.policies.map((policy) => ({
          ...policy,
          status: policy.version === effectiveActive.version ? 'ACTIVE' : policy.status === 'ACTIVE' ? 'SUPERSEDED' : policy.status
        }));
      }
    } else {
      state.policies = [policyV5];
    }
  } catch (error) {
    console.error('Policy hydration failed:', error instanceof Error ? error.message : 'Unknown policy hydration error');
  }
  try {
    const candidateDirectories = [
      path.resolve(process.cwd(), 'Cantill_FullStack_Task_Kit/contracts/pdf'),
      path.resolve(process.cwd(), '../Cantill_FullStack_Task_Kit/contracts/pdf')
    ];
    let pdfDirectory = candidateDirectories.find((candidate) => existsSync(candidate));
    if (!pdfDirectory) pdfDirectory = candidateDirectories[0];
    const entries = await fs.readdir(pdfDirectory).catch(() => []);
    for (const filename of entries.filter((name) => name.toLowerCase().endsWith('.pdf'))) {
      const buffer = await fs.readFile(path.join(pdfDirectory, filename));
      const extracted = await pdfParse(buffer);
      const contract = parseContractPdfText(extracted.text, filename);
      if (contract.contractId) {
        const existing = state.contracts.findIndex((item) => item.contractId === contract.contractId);
        if (existing >= 0) state.contracts[existing] = { ...state.contracts[existing], ...contract, verified: state.contracts[existing].verified };
        else state.contracts.push(contract);
        await Contract.updateOne(
          { contractId: contract.contractId },
          { $set: contract },
          { upsert: true }
        ).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Signed contract PDF import failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  app.listen(env.port, () => console.log(`ProcureFlow API listening on port ${env.port}`));
}

if (process.env.NODE_ENV !== 'test') {
  await startServer();
}
export { app, state };
