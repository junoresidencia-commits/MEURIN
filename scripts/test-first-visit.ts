import assert from "node:assert/strict";
import {
  advancedKidneyDisease,
  arrivedWithoutExams,
  classifyArrivalExams,
  identityKey,
  incompleteWorkup,
  isReturnBooking,
  pickFirstVisit,
  splitLabsAtVisit,
  type LabPoint,
} from "../src/lib/first-visit";
import {
  anonymizeFirstVisit,
  extractFirstVisitRecord,
  firstVisitStats,
  matchesFirstVisitFilters,
  type FirstVisitRecord,
} from "../src/lib/first-visit-extract";
import { canExportStudy } from "../src/lib/research-governance";
import { preferredFixTab } from "../src/lib/research-missing";

const DOC = "doc-1";
const VISIT = "2024-03-10T14:00:00.000Z";

function lab(testKey: string, value: number, measuredAt: string): LabPoint {
  return { testKey, value, measuredAt };
}

function status(exams: { key: string; status: string }[], key: string) {
  return exams.find((e) => e.key === key)?.status;
}

/* --- seleção da primeira consulta --- */
{
  const first = pickFirstVisit({
    doctorId: DOC,
    bookings: [
      { id: "b2", doctorId: DOC, patientEmail: "a@x.com", slotStart: "2024-06-01T10:00:00.000Z", courtesyKind: "retorno" },
      { id: "b1", doctorId: DOC, patientEmail: "a@x.com", slotStart: VISIT, careReason: "pressa" },
    ],
    notes: [],
  });
  assert.equal(first?.bookingId, "b1");
  assert.equal(first?.certainty, "confirmada");
  assert.equal(isReturnBooking({ id: "r", doctorId: DOC, patientEmail: "a", slotStart: VISIT, courtesyKind: "retorno" }), true);
  assert.equal(isReturnBooking({ id: "r", doctorId: DOC, patientEmail: "a", slotStart: VISIT, careReason: "acompanhamento" }), false);
}

{
  const onlyReturn = pickFirstVisit({
    doctorId: DOC,
    bookings: [{ id: "r", doctorId: DOC, patientEmail: "a@x.com", slotStart: VISIT, courtesyKind: "retorno" }],
    notes: [],
  });
  assert.equal(onlyReturn?.certainty, "incerta");
  assert.match(onlyReturn?.certaintyReason || "", /retorno/i);
}

{
  const noteOnly = pickFirstVisit({
    doctorId: DOC,
    bookings: [],
    notes: [{ id: "n1", doctorId: DOC, createdAt: VISIT, assessment: "DRC" }],
  });
  assert.equal(noteOnly?.source, "nota");
  assert.equal(noteOnly?.certainty, "incerta");
}

{
  const cancelled = pickFirstVisit({
    doctorId: DOC,
    bookings: [
      { id: "c", doctorId: DOC, patientEmail: "a@x.com", slotStart: "2024-01-01T10:00:00.000Z", status: "cancelled", careReason: "pressa" },
      { id: "ok", doctorId: DOC, patientEmail: "a@x.com", slotStart: VISIT, careReason: "segunda_opiniao" },
    ],
    notes: [],
  });
  assert.equal(cancelled?.bookingId, "ok");
}

{
  const acompanhamento = pickFirstVisit({
    doctorId: DOC,
    bookings: [{ id: "b", doctorId: DOC, patientEmail: "a@x.com", slotStart: VISIT, careReason: "acompanhamento" }],
    notes: [],
  });
  assert.equal(acompanhamento?.certainty, "provavel");
}

/* --- exames trazidos vs pedidos depois (congelados na 1ª consulta) --- */
{
  const { brought, after } = splitLabsAtVisit(
    [
      lab("creatinina", 1.2, "2024-03-01T00:00:00.000Z"),
      lab("creatinina", 4.8, "2024-09-01T00:00:00.000Z"),
      lab("potassio", 4.1, "2024-03-09T00:00:00.000Z"),
      lab("hba1c", 7.2, "2025-01-01T00:00:00.000Z"),
    ],
    VISIT
  );
  assert.equal(brought.length, 2);
  assert.equal(after.length, 2);
  const exams = classifyArrivalExams({ labsBrought: brought, labsAfter: after, sex: "feminino" });
  assert.equal(status(exams, "creatinina"), "disponivel");
  assert.equal(exams.find((e) => e.key === "creatinina")?.value, "1,2");
  assert.equal(exams.find((e) => e.key === "creatinina")?.requestedAfter, true);
  assert.equal(status(exams, "potassio"), "disponivel");
  assert.equal(status(exams, "hba1c"), "solicitado_apos");
  assert.equal(status(exams, "rac"), "sem_registro");
}

{
  const exams = classifyArrivalExams({
    labsBrought: [],
    labsAfter: [lab("creatinina", 2, "2024-06-01T00:00:00.000Z")],
    noteText: "Paciente chegou sem exames.",
  });
  assert.equal(status(exams, "creatinina"), "solicitado_apos");
  assert.equal(status(exams, "ureia"), "nao_apresentado");
  assert.equal(arrivedWithoutExams(exams), true, "pedido depois não conta como exame da chegada");
}

/* chegou sem nenhum exame (nada trazido e nada depois) */
{
  const exams = classifyArrivalExams({
    labsBrought: [],
    labsAfter: [],
    noteText: "Chegou sem exames.",
  });
  assert.equal(arrivedWithoutExams(exams), true);
  assert.equal(incompleteWorkup(exams), true);
}

{
  const exams = classifyArrivalExams({
    labsBrought: [lab("creatinina", 1.4, "2024-03-01T00:00:00.000Z")],
    labsAfter: [],
  });
  assert.equal(incompleteWorkup(exams), true, "falta eixo urinário");
}

{
  const exams = classifyArrivalExams({
    labsBrought: [
      lab("creatinina", 1.4, "2024-03-01T00:00:00.000Z"),
      lab("rac", 45, "2024-03-01T00:00:00.000Z"),
    ],
    labsAfter: [],
  });
  assert.equal(incompleteWorkup(exams), false);
}

assert.equal(advancedKidneyDisease({ tfge: 22 }), true);
assert.equal(advancedKidneyDisease({ estagioG: "G4" }), true);
assert.equal(advancedKidneyDisease({ tfge: 58, estagioG: "G3a" }), false);

/* --- extração: foto da 1ª consulta, não o perfil atual --- */
{
  const rec = extractFirstVisitRecord({
    patientId: "p1",
    patientKey: "ana@x.com",
    identityKey: "cpf:12345678901",
    name: "Ana Silva",
    birthdate: "1960-01-15",
    sex: "feminino",
    address: "Irecê - BA",
    medications: "Losartana 50 mg",
    diseases: "HAS e DM",
    doctorId: DOC,
    anchor: {
      visitAt: VISIT,
      source: "booking",
      bookingId: "b1",
      noteId: "n1",
      careReason: "pressa",
      courtesyKind: null,
      locationName: "Clínica Centro",
      patientCity: "Irecê",
      certainty: "confirmada",
      certaintyReason: "ok",
    },
    notes: [{
      id: "n1",
      doctorId: DOC,
      createdAt: VISIT,
      chiefComplaint: "Encaminhada pela UBS por creatinina alta",
      history: "HAS e DM. PA 160/100. Sem exames de urina. USG rins mencionada.",
      assessment: "Suspeita de DRC G4. Chegou sem exames completos.",
      plan: "Solicitar RAC e USG",
    }],
    labs: [
      lab("creatinina", 2.8, "2024-03-08T00:00:00.000Z"),
      lab("tfge", 22, "2024-03-08T00:00:00.000Z"),
      lab("creatinina", 5.1, "2025-01-10T00:00:00.000Z"),
      lab("rac", 120, "2024-06-01T00:00:00.000Z"),
    ],
    docs: [],
    uploads: [],
    vitals: [{ kind: "bp", systolic: 160, diastolic: 100, measuredAt: "2024-03-10T13:00:00.000Z" }],
  });
  assert.equal(rec.creatinina, 2.8, "creatinina da chegada, não a de 2025");
  assert.equal(rec.tfge, 22);
  assert.equal(rec.doencaAvancada, true);
  assert.equal(rec.municipio, "Irecê");
  assert.equal(rec.sexo, "feminino");
  assert.ok((rec.idade || 0) >= 64);
  assert.equal(rec.pa, "160/100");
  assert.match(rec.medicamentos, /Losartana/i);
  assert.equal(status(rec.exames, "creatinina"), "disponivel");
  assert.notEqual(status(rec.exames, "outros"), "disponivel", "TFGe calculada não conta como outro exame trazido");
  assert.equal(status(rec.exames, "rac"), "solicitado_apos", "RAC só depois do nefrologista");
  assert.equal(status(rec.exames, "usg_renal"), "disponivel");
  assert.equal(rec.exames.find((e) => e.key === "creatinina")?.requestedAfter, true);

  const laterNote = extractFirstVisitRecord({
    ...{
      patientId: "p1",
      patientKey: "ana@x.com",
      identityKey: "cpf:12345678901",
      name: "Ana Silva",
      birthdate: "1960-01-15",
      sex: "feminino",
      address: "Irecê - BA",
      doctorId: DOC,
      anchor: {
        visitAt: VISIT,
        source: "booking" as const,
        bookingId: "b1",
        noteId: "n1",
        careReason: "pressa",
        courtesyKind: null,
        locationName: null,
        patientCity: "Irecê",
        certainty: "confirmada" as const,
        certaintyReason: "ok",
      },
      notes: [
        { id: "n1", doctorId: DOC, createdAt: VISIT, assessment: "DRC G4 na chegada" },
        { id: "n2", doctorId: DOC, createdAt: "2025-11-01T10:00:00.000Z", assessment: "Melhora após diálise — NÃO usar" },
      ],
      labs: [lab("creatinina", 2.8, "2024-03-08T00:00:00.000Z")],
    },
  });
  assert.match(laterNote.diagnostico, /chegada/i);
  assert.equal(laterNote.diagnostico.includes("diálise"), false);
}

/* --- filtros, painel, anonimização --- */
{
  const rec = extractFirstVisitRecord({
    patientId: "p2",
    patientKey: "joao@x.com",
    identityKey: "key:joao@x.com",
    name: "João",
    birthdate: "1980-06-01",
    sex: "masculino",
    address: "Lapão",
    doctorId: DOC,
    anchor: {
      visitAt: VISIT,
      source: "booking",
      bookingId: "b2",
      noteId: null,
      careReason: "acompanhamento",
      courtesyKind: null,
      locationName: null,
      patientCity: "Lapão",
      certainty: "provavel",
      certaintyReason: "primeiro horário",
    },
    notes: [],
    labs: [],
  });
  assert.equal(rec.semExames, true);
  assert.equal(matchesFirstVisitFilters(rec, { municipio: "lapao" }), true);
  assert.equal(matchesFirstVisitFilters(rec, { municipio: "irece" }), false);
  assert.equal(matchesFirstVisitFilters(rec, { from: "2025-01-01" }), false);
  const stats = firstVisitStats([rec], 1);
  assert.equal(stats.semExames, 1);
  assert.equal(stats.semExamesPct, 100);
  assert.equal(stats.exames.find((e) => e.key === "creatinina")?.pct, 0);

  const anon = anonymizeFirstVisit([rec]);
  assert.equal(anon[0].codigo, "P0001");
  assert.equal("nome" in anon[0], false);
  assert.equal(JSON.stringify(anon).includes("João"), false);
  assert.equal(JSON.stringify(anon).includes("joao@"), false);
}

/* --- sem duplicar o mesmo CPF --- */
assert.equal(identityKey("123.456.789-01", "a@x.com"), identityKey("12345678901", "b@y.com"));
assert.notEqual(identityKey(null, "a@x.com"), identityKey(null, "b@y.com"));

/* --- governança existente continua igual (pesquisa não quebrou) --- */
{
  const blocked = canExportStudy({ ethicsStatus: "none" });
  assert.equal(blocked.ok, false);
  const ok = canExportStudy({ ethicsStatus: "approved", protocolCode: "CEP-1" });
  assert.equal(ok.ok, true);
  assert.equal(preferredFixTab([{ fixTab: "perfil" }, { fixTab: "exames" }]), "perfil");
}

console.log("primeira-consulta ok");
