/**
 * AI SERVICE
 * 
 * Integración con DeepSeek API para respuestas automáticas inteligentes
 */

const { getHumanDelay, isSpamming } = require('../utils/humanization');
const { appSettings } = require('../utils/constants');

// ESM axios (loaded dynamically)
let axios;

async function loadAxios() {
    if (axios) return;
    try {
        const axiosMod = await import('axios');
        axios = axiosMod.default || axiosMod;
        console.log('[AI_SERVICE] Axios loaded');
    } catch (err) {
        console.error('[AI_SERVICE] Failed to load axios:', err.message);
    }
}

/**
 * Determina si un mensaje parece una pregunta que el bot debe responder
 * @param {string} messageBody - Contenido del mensaje
 * @returns {boolean} true si debe responder
 */
function shouldRespondToMessage(messageBody, sender) {
    if (!messageBody || !messageBody.trim()) return false;

    // ALWAYS respond to direct messages (DMs)
    if (sender && sender.endsWith('@s.whatsapp.net')) {
        return true;
    }

    const keywords = [
        'ayuda', 'como', 'qué', 'que', 'cómo', 'pago', 'retiro',
        'error', 'soporte', '?', 'problema', 'help', 'info',
        'por que', 'porque', 'cuando', 'donde', 'cuanto',
        'bot', 'piedra', 'jugar', 'hola', 'buenas', 'start', 'iniciar'
    ];

    const lowerBody = messageBody.toLowerCase();
    return lowerBody.includes('?') || keywords.some(k => lowerBody.includes(k));
}

/**
 * Obtiene una respuesta de IA usando DeepSeek API
 * @param {string} userMessage - Mensaje del usuario
 * @param {string} systemPrompt - Prompt del sistema (opcional, usa appSettings por defecto)
 * @returns {Promise<string>} Respuesta de la IA
 */
async function getAIResponse(userMessage, systemPrompt = null) {
    await loadAxios();

    if (!axios) {
        throw new Error('Axios not loaded');
    }

    if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const defaultPrompt = `Eres el asistente oficial de Piedra.fun.
    OBJETIVO: Persuadir al usuario para que juegue y apueste YA.
    REGLA DE ORO: Máximo 20 palabras.
    ESTILO: Entusiasta, directo, usa emojis 🚀 💰.
    
    NO expliques reglas a menos que pregunten.
    NO saludes si no es necesario.
    
    EJEMPLOS:
    U: "Cómo juego?"
    B: "¡Recarga monedas y gana en segundos! 🤑 ¡Entra a una arena ahora! 🚀"
    
    U: "Hola"
    B: "¡Hola! 👋 ¿Listo para ganar dinero real? 💰 ¡Juega ya!"`;

    const prompt = systemPrompt || appSettings.ai_faq_prompt || defaultPrompt;

    console.log('[AI_SERVICE] Calling DeepSeek API...');

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: userMessage }
        ],
        temperature: 0.8,
        max_tokens: 200
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 second timeout
    });

    const aiResponse = response.data?.choices?.[0]?.message?.content;

    if (!aiResponse) {
        throw new Error('Empty response from DeepSeek');
    }

    console.log(`[AI_SERVICE] Got response (${aiResponse.length} chars)`);
    return aiResponse;
}

/**
 * Procesa un mensaje entrante y genera respuesta si es apropiado
 * @param {Object} messageData - Datos del mensaje { sender, body }
 * @returns {Promise<Object|null>} { shouldRespond, response, error }
 */
async function processIncomingMessage(messageData) {
    const { sender, body } = messageData;

    // Validar mensaje vacío
    if (!body || !body.trim()) {
        console.log('[AI_SERVICE] Empty message, ignoring');
        return { shouldRespond: false, reason: 'empty_message' };
    }

    // Anti-spam check
    if (isSpamming(sender)) {
        console.log(`[AI_SERVICE] Spam detected from ${sender}, ignoring`);
        return { shouldRespond: false, reason: 'spam_detected' };
    }

    // Verificar si es una pregunta o si debemos responder (DM)
    if (!shouldRespondToMessage(body, sender)) {
        console.log(`[AI_SERVICE] Message doesn't look like a question, ignoring`);
        return { shouldRespond: false, reason: 'not_a_question' };
    }

    console.log(`[AI_SERVICE] Processing question from ${sender}: ${body.substring(0, 50)}...`);

    try {
        // Initial delay (reading message)
        const readingDelay = getHumanDelay(800, 1500);
        await new Promise(resolve => setTimeout(resolve, readingDelay));

        // Get AI response
        const aiResponse = await getAIResponse(body);

        return {
            shouldRespond: true,
            response: aiResponse,
            error: null
        };

    } catch (error) {
        console.error('[AI_SERVICE] Error processing message:', error.message);

        // Determine friendly error message
        let errorMsg = '¡Hola! Estoy teniendo problemas técnicos. ¿Podrías contactar al soporte por favor? 🙏';

        if (error.response?.status === 429) {
            errorMsg = '¡Ups! Estoy recibiendo muchas preguntas en este momento. Por favor intenta de nuevo en unos segundos. 😅';
        } else if (error.message.includes('DEEPSEEK_API_KEY')) {
            errorMsg = '¡Hola! En este momento el servicio de IA está temporalmente deshabilitado. Por favor contacta al soporte. 😊';
        }

        return {
            shouldRespond: true,
            response: errorMsg,
            error: error.message
        };
    }
}

module.exports = {
    getAIResponse,
    shouldRespondToMessage,
    processIncomingMessage,
    loadAxios
};
