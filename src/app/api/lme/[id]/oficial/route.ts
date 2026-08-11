import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import { getPatientEmail } from "@/lib/patient-session";
import { getLme } from "@/lib/lme-store";

/**
 * Preenche o PDF oficial do CEAF (AcroForm) com os dados da LME e devolve para
 * download. Campos com nomes claros são preenchidos; a seleção de medicamento
 * (dropdown oficial) e a grade de quantidades devem ser revisadas/completadas
 * pelo médico no próprio formulário antes de assinar.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lme = await getLme(id);
  if (!lme) return NextResponse.json({ error: "LME não encontrada." }, { status: 404 });

  const doctorId = await getDoctorSessionId();
  const patientEmail = await getPatientEmail();
  const isOwnerDoctor = doctorId && doctorId === lme.doctorId;
  const isPatient = patientEmail && lme.patientEmail.toLowerCase() === patientEmail.toLowerCase();
  if (!isOwnerDoctor && !isPatient) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }

  // Lê o PDF oficial servido em /public.
  const pdfUrl = new URL("/forms/lme-oficial.pdf", req.url);
  const bytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  const setText = (name: string, value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return;
    try {
      form.getTextField(name).setText(String(value));
    } catch {
      /* campo ausente/diferente — ignora */
    }
  };
  const selectRadio = (name: string, value: string) => {
    try {
      form.getRadioGroup(name).select(value);
    } catch {
      /* opção diferente — ignora */
    }
  };
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  /** Seleciona no dropdown oficial (Selecao med N) a opção que casa com o medicamento. */
  const selectMed = (idx: number, label: string) => {
    try {
      const dd = form.getDropdown(`Selecao med ${idx}`);
      const opts = dd.getOptions();
      const want = norm(label);
      const found = opts.find((o) => norm(o) === want) || opts.find((o) => want && norm(o).startsWith(want));
      if (found) dd.select(found);
    } catch {
      /* dropdown ausente — ignora */
    }
  };

  const dt = new Date(lme.createdAt);
  const dateStr = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;

  setText("CNES", lme.cnes);
  setText("Nome do estabelecimento de saúde", lme.establishmentName);
  setText("Nome do paciente", lme.patientName);
  setText("Nome da mãe do paciente", lme.motherName);
  setText("Peso", lme.weightKg);
  setText("Altura", lme.heightCm);
  setText("CID", lme.cid10);
  setText("Diagnóstico", lme.diagnosis);
  setText("Anamnese", lme.anamnesis);
  setText("Etnia", lme.race);
  setText("Telefone I", lme.patientPhone);
  setText("email", lme.patientEmailContact);
  setText("Nome do preencher", lme.doctorName);
  setText("Text46", lme.doctorName); // 14- Nome do médico solicitante
  setText("TextCNS", lme.doctorCns); // CNS do médico (sempre reutilizado do perfil)
  setText("Today", dateStr);
  selectRadio("Incapaz?", lme.incapable ? "SIM" : "NÃO");

  // Documento do paciente: preferir CNS; senão CPF. Marca o tipo e escreve o número.
  const patientDoc = lme.patientCns || lme.patientCpf || "";
  if (patientDoc) {
    selectRadio("Documentos", lme.patientCns ? "CNS" : "CPF");
    setText("Text25b", patientDoc); // campo confirmado do "Número do documento do paciente"
  }

  // Medicamentos: seleciona a opção OFICIAL no dropdown (Selecao med N) + texto de apoio.
  const medTextFields = ["med1", "med2", "med3", "med4", "med5", "med6"];
  lme.medications.slice(0, 6).forEach((m, i) => {
    const label = m.presentation ? `${m.name} (${m.presentation})` : m.name;
    selectMed(i + 1, label);
    setText(medTextFields[i], label);
  });

  const out = await doc.save();
  return new NextResponse(Buffer.from(out), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lme-oficial-preenchida.pdf"`,
    },
  });
}
