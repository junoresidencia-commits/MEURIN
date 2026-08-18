import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";

export const maxDuration = 60;

// Extrai dados de um rótulo a partir de foto (dataURL). Usa OpenAI Vision quando
// OPENAI_API_KEY estiver configurada; caso contrário, retorna template para preenchimento
// manual. Em ambos os casos, a UI mostra uma tela de CONFIRMAÇÃO antes de salvar.
export async function POST(req: Request) {
  const email = await getPatientEmail();
  if (!email) return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const image = typeof b.image === "string" && b.image.startsWith("data:") ? b.image : "";
  if (!image) return NextResponse.json({ error: "Envie a foto do rótulo." }, { status: 400 });

  const key = process.env.OPENAI_API_KEY;
  const emptyFields = { food: "", portion_g: "", sodium_mg: "", protein_g: "", carb_g: "", sugars_g: "", fat_g: "", fiber_g: "", potassium_mg: "", phosphorus_mg: "", ingredients: "", additivesPhosphorus: false, additivesPotassium: false };
  if (!key) {
    return NextResponse.json({ manual: true, fields: emptyFields, note: "Leitura automática indisponível — confira e preencha os dados do rótulo." });
  }

  try {
    const prompt = "Extraia os dados nutricionais deste rótulo de alimento brasileiro. Responda APENAS em JSON com as chaves: food (nome do produto), portion_g (porção em gramas, número), sodium_mg, protein_g, carb_g, sugars_g, fat_g, fiber_g, potassium_mg, phosphorus_mg (números por porção; use string vazia se não houver), ingredients (texto), additivesPhosphorus (true se houver aditivo com fósforo/fosfato), additivesPotassium (true se houver cloreto de potássio ou sal de potássio). Não invente valores ausentes.";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }],
        response_format: { type: "json_object" },
        max_tokens: 500,
      }),
    });
    if (!res.ok) throw new Error("vision failed");
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return NextResponse.json({ manual: false, fields: { ...emptyFields, ...parsed } });
  } catch (err) {
    console.error("nutrition/label", err);
    return NextResponse.json({ manual: true, fields: emptyFields, note: "Não foi possível ler automaticamente — confira e preencha os dados do rótulo." });
  }
}
