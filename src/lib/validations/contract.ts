// Schema de validação para o formulário/Server Action de contratos.
//
// NOTA: a sintaxe do Zod abaixo (z.object, z.string, etc.) é estável
// há bastante tempo e tenho confiança razoável nela, mas se você
// estiver usando uma versão muito recente do Zod (v4+), alguns
// métodos podem ter mudado de assinatura — vale conferir o changelog
// se algo não compilar.

import { z } from 'zod'

export const contractSchema = z.object({
  process_number: z
    .string()
    .min(1, 'Número do processo é obrigatório'),
  title: z
    .string()
    .min(1, 'Título é obrigatório'),
  client_name: z
    .string()
    .min(1, 'Nome do cliente é obrigatório'),
  company_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('')),
  value: z
    .number()
    .nonnegative('Valor não pode ser negativo')
    .default(0),
  stage_id: z
    .string()
    .uuid('Etapa inválida'),
  description: z.string().optional(),
  expected_close_date: z.string().optional(), // formato ISO (yyyy-mm-dd)
})

export type ContractFormValues = z.infer<typeof contractSchema>
