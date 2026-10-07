import { GoogleGenerativeAI } from '@google/generative-ai';

// process.env.GEMINI_API_KEY será cargado si el usuario tiene la variable en su entorno
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function invokeCopilot(prompt: string, currentConfig: any) {
  if (!apiKey) {
    throw new Error('No se ha configurado la clave API de Gemini. Exporta GEMINI_API_KEY en tu terminal.');
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const systemPrompt = `
  Eres un experto modificador de motos (Copiloto de ModSim).
  El usuario te pide hacer una modificación a su moto.
  Configuración actual y piezas modificadas hasta ahora: ${JSON.stringify(currentConfig)}

  Tu trabajo es interpretar su solicitud y responder EXCLUSIVAMENTE en formato JSON.
  
  El JSON debe seguir este esquema exacto:
  {
    "modifications": {
      "rearTire": { "width": number, "profile": number, "rim": number }, // Solo incluir si se modifica
      "sprocket": number, // Solo incluir si se modifica
      "chainring": number // Solo incluir si se modifica
    },
    "explanation": "Breve explicación en lenguaje natural de qué hace esta modificación, amigable.",
    "warnings": ["Advertencia 1 si el velocímetro se descalibra mucho o se pierde demasiada aceleración", "Advertencia 2 si aplica"] // OPCIONAL
  }
  
  No incluyas formato markdown como \`\`\`json. Solo devuelve el objeto puro.
  `;

  try {
    const result = await model.generateContent(`${systemPrompt}\n\nUsuario: ${prompt}`);
    const text = result.response.text();
    // Limpiar posible markdown devuelto por la IA
    const jsonStr = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    throw new Error(`Error en el copiloto: ${error.message}`);
  }
}
