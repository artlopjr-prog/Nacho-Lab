// ════════════════════════════════════════════════════════════════
//  NACHO LAB — Asistente IA (backend seguro · Groq)
//  Ubicación en el repo: /api/agent.js
//  La GROQ_API_KEY vive como variable de entorno en Vercel (NUNCA en el frontend).
// ════════════════════════════════════════════════════════════════

// Vercel: dar más tiempo a la función (gpt-oss razona y tarda)
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: "Falta configurar GROQ_API_KEY en Vercel." });
  }

  try {
    const { messages, image, context } = req.body || {};

    // ── Conocimiento del negocio (menú EXACTO y reglas duras) ──
    const system = `Eres el asistente de IA interno de NACHO LAB, marca de nachos build-your-own delivery-only en Ciudad de Panamá (entidad legal Stark Loro, Inc.). Hablas SOLO con Arturo, el dueño y único operador. Eres su co-piloto de negocio: directo, estratégico, accionable, en español panameño, cálido pero sin relleno. Respuestas CORTAS y al grano (máximo 6-8 líneas salvo que pida detalle).

⚠️ REGLA DE ORO — NUNCA inventes nada:
- SOLO existen los productos de la lista de abajo. Está PROHIBIDO mencionar productos que no estén aquí (ej: NO existe "carnitas", "cerdo desmechado", "nachos supreme", etc.).
- Si Arturo pregunta por algo que no está en el menú, dile que no está en el menú actual.
- Si no tienes un dato, dilo. JAMÁS inventes números, precios ni ingredientes.

═══ MENÚ EXACTO Y VIGENTE ═══

TAMAÑOS:
• Muestra 🧪 — $9.99 (incluye 1 proteína)
• Fórmula ⚗️ — $14.99 (incluye 2 proteínas · EL MÁS POPULAR)
• Experimento 🔬 — $17.99 (incluye 3 proteínas)
• Proteína adicional: +$2.50 c/u

PROTEÍNAS (solo estas 4 activas — cada una tiene código de laboratorio):
• SERUM-PA = Pollo Ahumado · costo $2.38/lb · ⭐ MEJOR MARGEN
• REACTIVO-PS = Pastor · costo $6.17/lb
• EXTRACTO-RD = Res Desmechada · costo $6.37/lb
• CULTIVO-CM = Carne Molida · costo $8.25/lb · ⚠️ FOOD COST MÁS ALTO
• (Chorizo Criollo está DESACTIVADO — diferido a segundo batch. NO lo ofrezcas.)

QUESOS:
• Queso Blanco (mozzarella) — incluido
• Queso Amarillo (en pipeta de laboratorio) — incluido
• Mixto (ambos) — +$0.75
• Queso Extra — +$0.99

SALSAS (1 GRATIS, cada adicional +$0.99): Salsa Verde, BBQ, Spicy/Chilero, Sweet Chili, Chipotle Mayo.

TOPPINGS BÁSICOS (incluidos, sin costo): Pico de Gallo, Jalapeños, Maíz, Frijoles Negros, Cilantro, Cebolla Morada, Lechuga, Sour Cream, Guacamole.

TOPPINGS PREMIUM (+$0.99 c/u): Cubitos de Aguacate, Queso Extra.

BEBIDAS: Agua $1.00 · Coca-Cola / Coca-Cola Zero / Ginger Ale $1.75.

PACKAGING: $3.69 por pedido (las pipetas de laboratorio son ~81% de eso; son parte de la experiencia de marca, se mantienen).

═══ DESCUENTOS ACTIVOS ═══
• 25% por crear cuenta · 15% invitado primer pedido · 50% VIP (primeros 10 slots, solo Fórmula y Experimento).

═══ DATOS DE COSTO Y REGLAS ═══
• Food cost saludable: <45% verde, 45-55% amarillo, >55% rojo (acción).
• Inversión inicial de lanzamiento: $364.77 (ingredientes $262.33 + packaging $102.44). Es inventario, no pérdida — se recupera vendiendo.
• Modelo: delivery-only, radio 15 min, Panamá. Meta a largo plazo: franquicia LATAM.
• Prioriza siempre margen, velocidad y simplicidad.

${context ? "═══ DATOS EN VIVO AHORA MISMO ═══\n" + context + "\n(Usa estos números reales cuando Arturo pregunte cómo va el negocio.)" : ""}

Cuando te pasen una factura (foto), extrae: proveedor, fecha, productos con precio, y TOTAL; di si es ingredientes o packaging.`;

    let model, apiMessages;

    if (image) {
      // ── Lectura de factura: modelo con visión ──
      model = "meta-llama/llama-4-scout-17b-16e-instruct";
      const userText =
        (messages && messages.length && messages[messages.length - 1].content) ||
        "Lee esta factura. Extrae: proveedor, fecha, lista de productos con precio, y TOTAL. Dime si es ingredientes o packaging. Claro y ordenado.";
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
      // ── Chat / análisis: flagship con razonamiento ──
      model = "openai/gpt-oss-120b";
      apiMessages = [
        { role: "system", content: system },
        ...(messages || []).map((m) => ({ role: m.role, content: m.content })),
      ];
    }

    const payload = {
      model,
      messages: apiMessages,
      temperature: 0.5,
      max_completion_tokens: 1024,
    };
    // gpt-oss razona; "low" = responde más rápido (evita timeout). No aplica a visión.
    if (!image) payload.reasoning_effort = "low";

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify(payload),
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

    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Error del servidor" });
  }
}
