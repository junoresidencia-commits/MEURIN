import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDoctorSessionId } from "@/lib/auth";
import { getPatientEmail } from "@/lib/patient-session";
import { getLme } from "@/lib/lme-store";
import { getDoctorById } from "@/lib/store";

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

  // Preenche um campo de texto com tamanho de fonte FIXO (evita o auto-size do
  // AcroForm, que deixa a letra gigante em caixas grandes como a Anamnese).
  const setText = (name: string, value?: string | number | null, size = 9) => {
    if (value === null || value === undefined || value === "") return;
    try {
      const f = form.getTextField(name);
      f.setText(String(value));
      f.setFontSize(size);
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
  /** Seleciona no dropdown oficial (Selecao med N) a opção que casa com o medicamento.
   * Retorna true se conseguiu selecionar (para não duplicar no campo de texto). */
  const selectMed = (idx: number, label: string): boolean => {
    try {
      const dd = form.getDropdown(`Selecao med ${idx}`);
      const opts = dd.getOptions();
      const want = norm(label);
      const found = opts.find((o) => norm(o) === want) || opts.find((o) => want && norm(o).startsWith(want));
      if (found) {
        dd.select(found);
        try { dd.setFontSize(8); } catch { /* ok */ }
        return true;
      }
    } catch {
      /* dropdown ausente — ignora */
    }
    return false;
  };

  const dt = new Date(lme.createdAt);
  const dateStr = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;

  setText("CNES", lme.cnes);
  setText("Nome do estabelecimento de saúde", lme.establishmentName, 10);
  setText("Nome do paciente", lme.patientName, 10);
  setText("Nome da mãe do paciente", lme.motherName, 10);
  setText("Peso", lme.weightKg);
  setText("Altura", lme.heightCm);
  setText("CID", lme.cid10, 10);
  setText("Diagnóstico", lme.diagnosis, 9);
  setText("Anamnese", lme.anamnesis, 8);
  setText("Etnia", lme.race);
  setText("Telefone I", lme.patientPhone);
  setText("email", lme.patientEmailContact);
  setText("Nome do preencher", lme.doctorName, 10);
  setText("Text46", lme.doctorName, 10); // 14- Nome do médico solicitante
  setText("TextCNS", lme.doctorCns, 10); // CNS do médico (sempre reutilizado do perfil)
  setText("Today", dateStr, 10);
  selectRadio("Incapaz?", lme.incapable ? "SIM" : "NÃO");

  // Documento do paciente: preferir CNS; senão CPF. Marca o tipo e escreve o número.
  const patientDoc = lme.patientCns || lme.patientCpf || "";
  if (patientDoc) {
    selectRadio("Documentos", lme.patientCns ? "CNS" : "CPF");
    setText("Text25b", patientDoc); // campo confirmado do "Número do documento do paciente"
  }

  // Medicamentos: seleciona a opção OFICIAL no dropdown (Selecao med N). Só escreve
  // no campo de texto quando o dropdown NÃO casou — assim não sobrepõe os dois textos.
  const medTextFields = ["med1", "med2", "med3", "med4", "med5", "med6"];
  // Grade de quantidade por mês (6 colunas por linha de medicamento), mapeada por
  // posição no PDF oficial. Preenche a quantidade mensal em todos os meses do período.
  const qtyGrid: string[][] = [
    ["Text6", "Text7", "Text8", "Text6a", "Text7a", "Text8a"],
    ["Text10", "Text11", "Text12", "Text10a", "Text11a", "Text12a"],
    ["Text14", "Text15", "Text16", "Text14a", "Text15a", "Text16a"],
    ["Text18", "Text19", "Text20", "Text6b", "Text7b", "Text8b"],
    ["Text22", "Text23", "Text24", "Text10b", "Text11b", "Text12b"],
    ["Text22a", "Text23a", "Text24a", "Text14b", "Text15b", "Text16b"],
  ];
  lme.medications.slice(0, 6).forEach((m, i) => {
    const label = m.presentation ? `${m.name} (${m.presentation})` : m.name;
    const picked = selectMed(i + 1, label);
    if (!picked) setText(medTextFields[i], label, 8);
    const q = (m.monthlyQty ?? "").toString().trim();
    if (q) qtyGrid[i].forEach((fn) => setText(fn, q, 8));
  });

  // Assinatura visual do médico (imagem) no campo 17 (Assinatura e carimbo).
  try {
    const doctor = lme.doctorId ? await getDoctorById(lme.doctorId) : null;
    const sig = doctor?.signatureUrl;
    if (sig && sig.startsWith("data:")) {
      const b64 = sig.split(",")[1] || "";
      const raw = Uint8Array.from(Buffer.from(b64, "base64"));
      const img = sig.includes("image/jpeg") || sig.includes("image/jpg")
        ? await doc.embedJpg(raw)
        : await doc.embedPng(raw);
      const page = doc.getPages()[0];
      // Caixa "17- Assinatura e carimbo do médico" (à direita do nome). Coordenadas em pt (A4).
      const boxX = 392, boxY = 170, boxW = 166, boxH = 52;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, width: w, height: h });
    } else if (lme.doctorName) {
      // Fallback: assinatura "manuscrita" tipografada, para o campo não ficar vazio.
      const page = doc.getPages()[0];
      const font = await doc.embedFont(StandardFonts.HelveticaOblique);
      page.drawText(lme.doctorName, { x: 400, y: 190, size: 12, font });
    }
  } catch {
    /* assinatura indisponível — segue sem imagem */
  }

  const out = await doc.save();
  return new NextResponse(Buffer.from(out), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lme-oficial-preenchida.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
