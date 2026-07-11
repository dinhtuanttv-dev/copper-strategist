import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const runtime = 'edge'; 

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: google('gemini-1.5-flash'),
    messages,
  });

  // Sử dụng phương thức thay thế mà IDE gợi ý
  return result.toTextStreamResponse();
}