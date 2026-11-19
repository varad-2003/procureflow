import mongoose from 'mongoose';

const { Schema } = mongoose;
const timestamps = true;

export const User = mongoose.model('User', new Schema({
  name: { type: String, required: true }, email: { type: String, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true }, role: { type: String, enum: ['EMPLOYEE', 'BUYER', 'ADMIN'], default: 'EMPLOYEE' }
}, { timestamps }));
export const Item = mongoose.model('Item', new Schema({
  itemCode: { type: String, unique: true, index: true }, description: String, uom: String, category: String,
  itemType: String, standardPrice: Number
}, { timestamps }));
export const Supplier = mongoose.model('Supplier', new Schema({
  supplierId: { type: String, unique: true, index: true }, name: String, city: String, categories: [String],
  status: { type: String, index: true }, onTimePct: Number, qualityRating: Number
}, { timestamps }));
export const Plant = mongoose.model('Plant', new Schema({ code: { type: String, unique: true }, name: String }, { timestamps }));
export const PurchaseHistory = mongoose.model('PurchaseHistory', new Schema({
  poNumber: String, poDate: Date, supplierId: String, itemCode: String, quantity: Number, uom: String,
  unitPrice: Number, plant: String, deliveredOnTime: Boolean
}, { timestamps }));
export const Contract = mongoose.model('Contract', new Schema({
  contractId: { type: String, unique: true, index: true }, supplierId: String, supplierName: String,
  startDate: Date, endDate: Date, valueCap: Number, consumedValue: { type: Number, default: 0 },
  verified: { type: Boolean, default: false }, source: String, lines: [{ itemCode: String, description: String, uom: String, rate: Number }]
}, { timestamps }));
export const PurchaseRequest = mongoose.model('PurchaseRequest', new Schema({
  batchId: String, prNo: String, prLine: Number, createdAt: Date, requester: String, department: String,
  plant: String, itemCode: String, description: String, quantity: Number, uom: String,
  estimatedUnitPrice: Number, needByDate: Date, urgency: String, original: Schema.Types.Mixed
}, { timestamps }));
export const Requirement = mongoose.model('Requirement', new Schema({
  groupId: { type: String, unique: true }, lineIds: [Schema.Types.ObjectId], resolvedItemCode: String,
  plant: String, requirementDate: Date, quantity: Number, value: Number, urgency: String
}, { timestamps }));
export const PurchaseOrder = mongoose.model('PurchaseOrder', new Schema({
  poId: { type: String, unique: true }, supplierId: String, plant: String, route: String,
  requirementIds: [String], value: Number, status: { type: String, default: 'DRAFT' }
}, { timestamps }));
export const Policy = mongoose.model('Policy', new Schema({
  policyId: String, version: String, effectiveDate: Date, uploadDate: Date, status: String,
  rules: [Schema.Types.Mixed], sourceDocument: String, changeSummary: String, approvedBy: String
}, { timestamps }));
export const Decision = mongoose.model('Decision', new Schema({
  groupId: String, lineIds: [Schema.Types.ObjectId], decision: String, route: String, supplierId: String,
  suggestedSupplierIds: [String], unitPrice: Number, groupValueInr: Number, policyVersion: String,
  clause: String, reason: String, inputValues: Schema.Types.Mixed, poId: String,
  overrideHistory: [Schema.Types.Mixed], status: { type: String, default: 'PENDING' }
}, { timestamps }));
export const AuditLog = mongoose.model('AuditLog', new Schema({
  actorId: String, action: String, entityType: String, entityId: String, details: Schema.Types.Mixed
}, { timestamps }));
export const ChatSession = mongoose.model('ChatSession', new Schema({
  sessionId: { type: String, unique: true, index: true }, userId: String, messages: [{ role: String, content: String, createdAt: Date }], draft: Schema.Types.Mixed,
  purchaseRequestId: String
}, { timestamps }));
export const BatchRun = mongoose.model('BatchRun', new Schema({
  batchHash: { type: String, unique: true, index: true },
  batchId: { type: String, index: true },
  policyVersion: String,
  lineCount: Number,
  groupCount: Number,
  resultSnapshot: Schema.Types.Mixed
}, { timestamps }));
