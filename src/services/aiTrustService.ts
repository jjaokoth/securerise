/*
  AI Trust Service
  - Attempts to use Google Gemini 1.5 Pro via @google/generative-ai.
  - If the dependency is not available (e.g., install permission issues), it fails closed.
*/

export type VerifyProofOfDeliveryResult = {
  confidence_score: number;
  reasoning: string;
  verified: boolean;
};

type VerifyParams = {
  imageBuffer: Buffer;
  handshakeMetadata: Record<string, unknown>;
};

function toSafeJsonText(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function coerceResult(input: any): VerifyProofOfDeliveryResult {
  const confidence = Number(input?.confidence_score);
  const verified = Boolean(input?.verified);
  const reasoning = typeof input?.reasoning === 'string' ? input.reasoning : '';

  // Basic sanity: if the model returned nonsense, we fail closed.
  const confidence_score = Number.isFinite(confidence) ? confidence : 0;

  return {
    confidence_score,
    reasoning,
    verified: Boolean(verified && confidence_score >= 0 && confidence_score <= 1),
  };
}

/**
 * AI Trust Service
 * - Uses Gemini 1.5 Pro to verify whether an image is a valid proof of delivery/transfer.
 * - Must detect deepfakes/screenshots-of-photos using pixel consistency checks.
 * - Returns strict JSON: { confidence_score, reasoning, verified }
 */
export async function verifyProofOfDelivery(
  params: VerifyParams
): Promise<VerifyProofOfDeliveryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  // Import dynamically so the codebase can compile even if dependency install is blocked.
  let GoogleGenerativeAI: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
  } catch {
    // Fail closed if the SDK isn't available.
    return {
      confidence_score: 0,
      reasoning: 'GEMINI_SDK_UNAVAILABLE',
      verified: false,
    };
  }

  // Gemini expects base64 media for multi-modal inputs.
  const imageBase64 = params.imageBuffer.toString('base64');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const handshakeMetadataText = toSafeJsonText(params.handshakeMetadata);

  const prompt = `You are an AI Vision Specialist for secure escrow handshakes.

Task:
Determine if the provided image is genuine proof that the item was delivered/transferred.

Verification checks (must consider all):
1) Physical presence: Does the image plausibly show the item being delivered/transferred?
2) Matching identity: Do visible names/labels/serial numbers/order references match the handshake metadata?
3) Consistency: Are colors, lighting, shadows, perspective, and textures internally consistent?

Security checks (anti-fraud):
- Detect deepfakes, AI-generated imagery, or tampering.
- Detect screenshots of photos, screen captures, or re-photos.
  Use pixel-consistency signals: compression artifacts consistency, aliasing patterns, moire/interpolation artifacts, edge halos, unnatural noise patterns, or mismatch between foreground/background.

Output requirements:
- Return ONLY valid JSON (no markdown, no extra text) with this exact schema:
  {"confidence_score": float, "reasoning": string, "verified": boolean}
- confidence_score must be a number between 0 and 1.
- verified must be true ONLY if the evidence strongly supports genuine delivery/transfer AND all key identifiers match.
- If the image appears to be a screenshot, edited, or otherwise untrustworthy, set verified=false and confidence_score <= 0.5.

Handshake metadata:
${handshakeMetadataText}

Image:
(You will be given an image as input.)`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    },
  ]);

  const text = result.response.text();

  // Gemini should return strict JSON; parse and fail closed.
  try {
    const parsed = JSON.parse(text);
    return coerceResult(parsed);
  } catch {
    return {
      confidence_score: 0,
      reasoning: 'MODEL_OUTPUT_NOT_VALID_JSON',
      verified: false,
    };
  }
}

