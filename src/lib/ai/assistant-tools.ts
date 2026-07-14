// Ferramentas do Assistente de IA. Divididas em duas categorias:
//
// - LEITURA (buscar/consultar): executadas na hora, sem confirmação —
//   não mudam nada no CRM, então não tem risco.
// - ESCRITA (criar/mover/atualizar): NUNCA executadas direto. O
//   assistente monta a ação, mas ela só roda depois que a pessoa
//   confirma explicitamente na tela — igual pedir pra alguém revisar
//   antes de assinar algo.
//
// Isso é intencional: um comando em linguagem natural pode ser
// interpretado errado, e ações de escrita mexem em dados reais.

export const READ_TOOLS = [
  {
    name: 'search_contracts',
    description: 'Busca contratos/oportunidades pelo nome do cliente ou número do processo. Use pra encontrar o ID de um contrato antes de fazer qualquer ação nele.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Nome do cliente ou número do processo (busca parcial)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_companies',
    description: 'Busca empresas pelo nome ou CNPJ.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Nome ou CNPJ da empresa (busca parcial)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_contract_details',
    description: 'Retorna detalhes completos de um contrato específico: etapa atual, valor, vigência, dono da conta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_id: { type: 'string', description: 'ID do contrato (obtido via search_contracts)' },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'list_stale_contracts',
    description: 'Lista contratos "parados" — sem nenhuma atividade registrada há mais de N dias, ainda em aberto.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Quantos dias sem atividade considerar "parado" (padrão 15)' },
      },
    },
  },
] as const

export const WRITE_TOOLS = [
  {
    name: 'create_company',
    description: 'Cria uma nova empresa no CRM.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Razão social / nome da empresa' },
        trade_name: { type: 'string', description: 'Nome fantasia (opcional)' },
        cnpj: { type: 'string', description: 'CNPJ (opcional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_note',
    description: 'Adiciona uma nota/observação no histórico de um contrato.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_id: { type: 'string', description: 'ID do contrato' },
        content: { type: 'string', description: 'Texto da nota' },
      },
      required: ['contract_id', 'content'],
    },
  },
  {
    name: 'move_contract_stage',
    description: 'Move um contrato pra outra etapa dentro do MESMO funil em que ele já está. Respeita a mesma regra de permissão da tela (só dono da conta ou admin).',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_id: { type: 'string', description: 'ID do contrato' },
        stage_name: { type: 'string', description: 'Nome exato da etapa de destino' },
      },
      required: ['contract_id', 'stage_name'],
    },
  },
] as const

export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS]
export const WRITE_TOOL_NAMES: Set<string> = new Set(WRITE_TOOLS.map((t) => t.name))
