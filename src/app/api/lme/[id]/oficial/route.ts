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
  setText("TextCNS", lme.doctorCns);
  setText("Today", dateStr);
  selectRadio("Incapaz?", lme.incapable ? "SIM" : "NÃO");

  // Medicamentos: tenta o texto livre (med2..med5) e, se houver, o primeiro campo.
  const medTextFields = ["med2", "med3", "med4", "med5"];
  lme.medications.slice(0, 5).forEach((m, i) => {
    const label = [m.name, m.presentation].filter(Boolean).join(" ");
    if (i === 0) setText("med1", label);
    setText(medTextFields[i - 1] || `med${i + 1}`, label);
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
