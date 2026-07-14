'use client'

import { useState } from 'react'

export function LeadsHelpCard() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-blue-900"
      >
        ℹ️ Como funciona esse módulo
        <span className="text-xs text-blue-400">{open ? 'Recolher ▲' : 'Expandir ▼'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-blue-100 px-4 py-3 text-sm text-blue-900">
          <div>
            <p className="font-medium">O que é um Lead?</p>
            <p className="text-blue-800/80">
              É um contato ANTES de virar uma oportunidade de verdade no funil — alguém que demonstrou interesse (preencheu o formulário, ligou, pediu informação), mas ainda não sabemos se vale a pena investir tempo comercial nele. Serve pra triar isso antes de entrar no funil de vendas.
            </p>
          </div>
          <div>
            <p className="font-medium">Como a pontuação funciona</p>
            <p className="text-blue-800/80">
              Baseada em sinais reais, não só em preencher campos: <strong>origem</strong> (indicação vale mais que anúncio), <strong>e-mail corporativo</strong> (vs pessoal), <strong>empresa parecer ser da área de saúde</strong> pelo nome (o público certo de vocês), telefone e mensagem com detalhe. Abre qualquer lead e tem um quadro &quot;Por que essa pontuação&quot; mostrando o cálculo exato.
            </p>
          </div>
          <div>
            <p className="font-medium">O fluxo de status</p>
            <p className="text-blue-800/80">
              <strong>Novo</strong> (acabou de chegar) → <strong>Em Qualificação</strong> (alguém está avaliando) → <strong>Qualificado</strong> (vale a pena, pronto pra converter) ou <strong>Descartado</strong> (não é o momento/perfil).
            </p>
          </div>
          <div>
            <p className="font-medium">Converter em Oportunidade</p>
            <p className="text-blue-800/80">
              Quando um lead está pronto, o botão &quot;Converter em Oportunidade&quot; cria (ou reaproveita, se já existir) a empresa e o contato, cria o contrato, e já joga tudo direto no funil de Novos Negócios — sem precisar recadastrar nada na mão.
            </p>
          </div>
          <div>
            <p className="font-medium">De onde vêm os leads</p>
            <p className="text-blue-800/80">
              Automaticamente pelo <a href="/captura" target="_blank" className="underline">formulário público de captação</a> (divulgue esse link em campanhas, no site, etc.) — ou cadastrados manualmente pelo time, com o botão &quot;+ Novo Lead&quot;.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
