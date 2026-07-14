import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { ALL_TOOLS } from '@/lib/ai/assistant-tools'
import { executeWriteTool } from '@/lib/ai/write-tools'

const SYSTEM_PROMPT = `Você é o Assistente de IA do CRM da ORBIS. Confirme brevemente o resultado da ação em português, de forma direta.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
  }

  const { messages, toolUseId, toolName, toolInput } = await request.json()

  const result = await executeWriteTool(toolName, toolInput)

  // Log de auditoria — mesmo espírito de "lastro" das Propostas: toda
  // ação real do assistente fica registrada, com quem pediu.
  await supabase.from('assistant_action_log').insert({
    user_id: user.id,
    tool_name: toolName,
    tool_input: toolInput,
    result_summary: result.error ? `ERRO: ${result.error}` : result.summary,
    contract_id: result.contractId ?? null,
  })

  const conversation = [
    ...messages,
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: result.error ? `Falhou: ${result.error}` : result.summary,
          is_error: !!result.error,
        },
      ],
    },
  ]

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: ALL_TOOLS as unknown as Anthropic.Tool[],
    messages: conversation,
  })

  conversation.push({ role: 'assistant', content: response.content })
  const textBlock = response.content.find((b) => b.type === 'text')

  return NextResponse.json({
    messages: conversation,
    finalText: textBlock && textBlock.type === 'text' ? textBlock.text : result.summary,
  })
}
