import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { addMembership, createClinic } from "../src/lib/platform-store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";
import { createEncounter, recordCheckIn } from "../src/lib/clinic-finance-store";
import { cashFlow, listExpenses } from "../src/lib/clinic-cash-store";
import { clinicStockPerm, type ClinicStaff } from "../src/lib/platform-access";
import { stockStatus } from "../src/lib/clinic-stock-labels";
import {
  adjustStock,
  confirmInventory,
  createPurchaseRequest,
  decidePurchaseRequest,
  listMoves,
  listStockProducts,
  receiveStock,
  stockOut,
  transferStock,
  upsertStockProduct,
  upsertSupplier,
} from "../src/lib/clinic-stock-store";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }
  const before = await collectIntegrityCounts();
  const db0 = await readDb();
  const carlos = db0.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos, "seed do Dr. Carlos permanece");

  assert.equal(stockStatus(12, 10), "normal");
  assert.equal(stockStatus(3, 5), "baixo");
  assert.equal(stockStatus(0, 5), "zerado");

  const clinic = await createClinic({ name: "Clinica Estoque Teste", city: "Salvador" });
  const other = await createClinic({ name: "Clinica Destino Teste", city: "Feira" });
  const membership = await addMembership({
    clinicId: clinic.id,
    actorKind: "doctor",
    actorId: carlos.id,
    role: "ADMIN_CLINICA",
  });
  await addMembership({
    clinicId: other.id,
    actorKind: "doctor",
    actorId: carlos.id,
    role: "ADMIN_CLINICA",
  });

  const staff = {
    kind: "attendant" as const,
    actorId: "att-1",
    email: "ludielle@meurim.com",
    name: "Ludielle",
    clinic,
    membership: { ...membership, actorKind: "attendant" as const, permissions: {} },
    isSuperAdmin: false,
    canAdmin: false,
    canCheckout: true,
  } satisfies ClinicStaff;
  assert.equal(clinicStockPerm(staff, "stock_view"), true);
  assert.equal(clinicStockPerm(staff, "stock_in"), true);
  assert.equal(clinicStockPerm(staff, "stock_manage"), false);
  const doctorStaff = { ...staff, kind: "doctor" as const, canAdmin: false };
  assert.equal(clinicStockPerm(doctorStaff, "stock_view"), false);
  const allowedDoctor = { ...doctorStaff, membership: { ...staff.membership, permissions: { stock_view: true } } };
  assert.equal(clinicStockPerm(allowedDoctor, "stock_view"), true);

  const enc = await createEncounter({
    clinicId: clinic.id,
    doctorId: carlos.id,
    patientKey: "maria.estoque@meurim.com",
    patientName: "Maria Estoque",
  });
  await recordCheckIn({
    clinicId: clinic.id,
    encounterId: enc.id,
    method: "cash",
    amountCents: 45000,
    recordedByKind: "attendant",
    recordedById: "att-1",
  });

  const algodao = await upsertStockProduct({
    clinicId: clinic.id,
    name: "Algodão",
    category: "material_medico",
    unit: "pacote",
    qty: 0,
    minQty: 10,
    idealQty: 20,
  });
  const luva = await upsertStockProduct({
    clinicId: clinic.id,
    name: "Luva tamanho M",
    category: "material_enfermagem",
    unit: "caixa",
    qty: 3,
    minQty: 5,
    idealQty: 12,
  });
  assert.equal(stockStatus(luva.qty, luva.minQty), "baixo");

  const otherLuva = await upsertStockProduct({
    clinicId: other.id,
    name: "Luva tamanho M",
    category: "material_enfermagem",
    unit: "caixa",
    qty: 8,
    minQty: 5,
  });
  assert.equal(otherLuva.qty, 8);
  const aList = await listStockProducts(clinic.id);
  assert.equal(aList.some((p) => p.qty === 8 && p.name === "Luva tamanho M"), false);

  const supplier = await upsertSupplier({ clinicId: clinic.id, name: "Distribuidora Bahia" });

  await assert.rejects(
    () =>
      receiveStock({
        clinicId: clinic.id,
        clinicName: clinic.name,
        productId: algodao.id,
        qty: 10,
        totalCents: 4800,
        createExpense: true,
        fromCash: true,
        confirmCash: false,
        actor: { kind: "attendant", id: "att-1", name: "Ludielle" },
      }),
    /Confirme a retirada/
  );

  const buy = await receiveStock({
    clinicId: clinic.id,
    clinicName: clinic.name,
    productId: algodao.id,
    qty: 10,
    totalCents: 4800,
    createExpense: true,
    fromCash: true,
    confirmCash: true,
    supplierId: supplier.id,
    actor: { kind: "attendant", id: "att-1", name: "Ludielle", email: "ludielle@meurim.com" },
  });
  assert.equal(buy.product.qty, 10);
  assert.equal(buy.product.avgCostCents, 480);
  assert.ok(buy.expenseId);
  assert.equal(buy.move.qtyBefore, 0);
  assert.equal(buy.move.qtyAfter, 10);

  const today = new Date().toISOString().slice(0, 10);
  const flow = await cashFlow(clinic.id, { from: today, to: today });
  assert.equal(flow.inCents, 45000);
  assert.equal(flow.outCents, 4800);
  assert.equal(flow.closingCents, 40200);

  const expenses = await listExpenses(clinic.id, today, today);
  assert.equal(expenses.some((e) => e.id === buy.expenseId && e.description.includes("Algodão")), true);

  const req = await createPurchaseRequest({
    clinicId: clinic.id,
    productId: luva.id,
    qty: 4,
    priority: "urgente",
    actor: { name: "Ludielle", kind: "attendant", id: "att-1" },
  });
  assert.equal(req.status, "solicitado");
  const approved = await decidePurchaseRequest({
    clinicId: clinic.id,
    requestId: req.id,
    action: "approve",
    actor: { name: "Gestora" },
  });
  assert.equal(approved.status, "aprovado");

  const out = await stockOut({
    clinicId: clinic.id,
    productId: algodao.id,
    qty: 2,
    reason: "uso_clinica",
    actor: { name: "Ludielle" },
  });
  assert.equal(out.product.qty, 8);

  await assert.rejects(
    () => confirmInventory({ clinicId: clinic.id, lines: [{ productId: algodao.id, countedQty: 6 }], justification: "curto" }),
    /justificativa/i
  );
  const inv = await confirmInventory({
    clinicId: clinic.id,
    lines: [{ productId: algodao.id, countedQty: 6 }],
    justification: "Contagem física menor que o sistema.",
    actor: { name: "Ludielle" },
  });
  assert.equal(inv.lines[0].systemQty, 8);
  assert.equal(inv.lines[0].countedQty, 6);
  const afterInv = await listStockProducts(clinic.id);
  assert.equal(afterInv.find((p) => p.id === algodao.id)?.qty, 6);

  const adj = await adjustStock({
    clinicId: clinic.id,
    productId: algodao.id,
    countedQty: 6,
    reason: "erro_contagem",
  });
  assert.equal(adj.difference, 0);

  const xfer = await transferStock({
    fromClinicId: clinic.id,
    toClinicId: other.id,
    productId: algodao.id,
    qty: 2,
    actor: { name: "Ludielle" },
  });
  assert.equal(xfer.from.qty, 4);
  assert.equal(xfer.to.qty, 2);
  const flowAfter = await cashFlow(clinic.id, { from: today, to: today });
  assert.equal(flowAfter.outCents, 4800, "transferência não gera despesa");

  const inactive = await upsertStockProduct({
    id: algodao.id,
    clinicId: clinic.id,
    name: "Algodão",
    category: "material_medico",
    unit: "pacote",
    minQty: 10,
    active: false,
  });
  assert.equal(inactive.active, false);
  const activeOnly = await listStockProducts(clinic.id);
  assert.equal(activeOnly.some((p) => p.id === algodao.id), false);
  const withInactive = await listStockProducts(clinic.id, true);
  assert.equal(withInactive.some((p) => p.id === algodao.id), true);

  const history = await listMoves(clinic.id, algodao.id);
  assert.ok(history.length >= 3);
  assert.ok(history.every((m) => m.clinicId === clinic.id));

  const after = await collectIntegrityCounts();
  const dropped = countsDropped(before, after);
  assert.equal(dropped.length, 0, `integridade caiu: ${dropped.join(", ")}`);

  const db1 = await readDb();
  assert.ok(db1.doctors.find((d) => d.email === "carlos@meurim.com"));
  console.log("ok clinic-stock");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
