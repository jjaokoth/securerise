// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeminiVerifyResult = any;

export type VerifyAssetResult = {
  isMatch: boolean;
  confidence: number;
  extractedDetails: string;
  issueDetected: boolean;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeCandidateString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || typeof v === 'undefined') return '';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function coerceOutput(input: GeminiVerifyResult): VerifyAssetResult {
  const isMatch = Boolean(input?.isMatch);
  const confidence = clamp01(Number(input?.confidence));
  const extractedDetails = normalizeCandidateString(input?.extractedDetails);
  const issueDetected = Boolean(input?.issueDetected);

  return { isMatch, confidence, extractedDetails, issueDetected };
}

export async function verifyAsset(imageBuffer: Buffer, expectedItem: string): Promise<VerifyAssetResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      isMatch: false,
      confidence: 0,
      extractedDetails: 'GEMINI_API_KEY_MISSING',
      issueDetected: true,
    };
  }

  let GoogleGenerativeAI: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
  } catch {
    return {
      isMatch: false,
      confidence: 0,
      extractedDetails: 'GEMINI_SDK_UNAVAILABLE',
      issueDetected: true,
    };
  }

  const imageBase64 = imageBuffer.toString('base64');

  const genAI = new GoogleGenerativeAI(apiKey);
  // Use production v1 endpoint and the latest Flash model.
  // Note: @google/generative-ai uses the v1 production API by default.
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash-latest',
  });



  const systemInstruction =
    'You are a professional quality inspector. Look at this image. Is it the item described as [expectedItem]? Extract part numbers and check for damage.';

  const prompt = `${systemInstruction.replace('[expectedItem]', expectedItem)}\n\nReturn ONLY valid JSON in the following exact schema:\n{ "isMatch": boolean, "confidence": number, "extractedDetails": string, "issueDetected": boolean }\n\nRules:\n- confidence must be a number between 0 and 1\n- extractedDetails should include extracted part numbers (if any) and a brief damage assessment\n- issueDetected should be true if damage/tampering is detected or the item looks suspicious\n`;

  // Gemini multimodal: provide text + inlineData
  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    },
  ]);

  const text = result?.response?.text?.() ?? '';

  try {
    const parsed = JSON.parse(text);
    return coerceOutput(parsed);
  } catch {
    // Fail closed
    return {
      isMatch: false,
      confidence: 0,
      extractedDetails: 'MODEL_OUTPUT_NOT_VALID_JSON',
      issueDetected: true,
    };
  }
}

