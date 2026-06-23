// ════════════════════════════════════════════════════════════════
//  NACHO LAB — Asistente IA (backend seguro · Groq)
//  Ubicación en el repo: /api/agent.js
//  La GROQ_API_KEY vive como variable de entorno en Vercel (NUNCA en el frontend).
// ════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // Solo aceptamos POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: "Falta configurar GROQ_API_KEY en Vercel." });
  }

  try {
    const { messages, image, context } = req.body || {};

    // ── Personalidad y conocimiento del asistente ──
    const system = `Eres el asistente de IA interno de NACHO LAB, una marca de nachos build-your-own delivery-only en Ciudad de Panamá (entidad legal Stark Loro, Inc.). Hablas SOLO con Arturo, el dueño y único operador. Eres su co-piloto de negocio: directo, estratégico, accionable, sin relleno. Respondes en español panameño, cálido pero profesional.

Tu trabajo: ayudarlo a GESTIONAR, CONTROLAR, ANALIZAR, RECOMENDAR e INVESTIGAR su negocio. Cuando te pase una factura, extraes proveedor, productos y total. Cuando pregunte por sus números, respondes con los datos reales de abajo, no con generalidades. Das recomendaciones concretas basadas en márgenes y food cost.

CONOCIMIENTO FIJO DEL NEGOCIO:
- Menú: Muestra $9.99 (1 proteína) · Fórmula $14.99 (2, +popular) · Experimento $17.99 (3). Proteína adicional +$2.50.
- Proteínas y costo real: Pollo Ahumado $2.38/lb (⭐ mejor margen) · Pastor $6.17/lb · Res $6.37/lb · Molida $8.25/lb (⚠️ food cost más alto).
- Packaging: $3.69 por pedido (las pipetas de laboratorio son ~81% de eso; son parte de la experiencia, se mantienen).
- Inversión inicial de lanzamiento: $364.77 (ingredientes $262.33 + packaging $102.44). Es inventario, no pérdida — se recupera vendiendo.
- Food cost saludable: bajo 45% verde, 45-55% amarillo, +55% rojo.
- Reglas: prioriza margen, velocidad y simplicidad. Piensa en escalar a franquicia LATAM.

${context ? "DATOS EN VIVO DE HOY:\n" + context : ""}

Si no tienes un dato, dilo honestamente — nunca inventes números.`;

    let model, apiMessages;

    if (image) {
      // ── Lectura de factura (visión con Llama 4 Scout) ──
      // Nota: los modelos de visión Llama van mejor sin "system" separado; metemos todo en el user.
      model = "meta-llama/llama-4-scout-17b-16e-instruct";
      const userText =
        (messages && messages.length && messages[messages.length - 1].content) ||
        "Lee esta factura. Extrae: proveedor, fecha, lista de productos con precio, y TOTAL. Dime también si es ingredientes o packaging. Sé claro y ordenado.";
      apiMessages = [
        {
          role: "user",
          content: [
            { type: "text", text: system + "\n\nTAREA: " + userText },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ];
    } else {
      // ── Chat / análisis (Llama 3.3 70B) ──
      model = "llama-3.3-70b-versatile";
      apiMessages = [
        { role: "system", content: system },
        ...(messages || []).map((m) => ({ role: m.role, content: m.content })),
      ];
    }

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.6,
        max_completion_tokens: 1200,
      }),
    });

    const data = await r.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || "Error de Groq" });
    }

    const reply =
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
      "No pude generar una respuesta. Intenta de nuevo.";

    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Error del servidor" });
  }
}
