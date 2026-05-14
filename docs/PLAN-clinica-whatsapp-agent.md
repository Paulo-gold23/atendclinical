# PLAN-clinica-whatsapp-agent.md

> **Protótipo:** Agente de Atendimento WhatsApp para Clínica Geral  
> **Criado em:** 2026-05-13  
> **Status:** 🟡 Planejamento

---

## Overview

MVP de um agente de atendimento conversacional com interface que simula o WhatsApp, voltado para clínicas. O público (potenciais clientes) interage com o frontend e não vê o backend. O objetivo é demonstrar a capacidade do agente: responder dúvidas, coletar dados do paciente e **agendar consultas via Google Calendar**.

**Decisão de arquitetura:**
- **Backend:** n8n (novo workflow simplificado, reaproveitando nodes já configurados: AI Agent, Google Calendar, memória PostgreSQL)
- **Frontend:** HTML/CSS/JS puro, visual nível intermediário (estilo WhatsApp), hospedado no **GitHub Pages**
- **Banco:** Supabase projeto `prontuario_ia` (`bkkdexuzrjouafrwzdsw`, `sa-east-1`) — tabelas novas isoladas prefixadas `atend_`
- **LLM:** OpenAI (já configurado no n8n)
- **Calendar:** Google Calendar (já configurado no n8n via `[CALENDARIO-MC] ClinicAI`)
- **WhatsApp real:** ❌ Não — mensagens chegam pelo frontend via HTTP para o webhook n8n

---

## Project Type

**WEB + BACKEND-AS-SERVICE (n8n)**

---

## Success Criteria

- [ ] Usuário envia mensagem no frontend e recebe resposta da IA em < 5s
- [ ] Agente coleta nome, telefone e motivo da consulta de forma conversacional
- [ ] Agente consulta disponibilidade e cria evento no Google Calendar
- [ ] Histórico de conversa persiste no Supabase entre mensagens
- [ ] Frontend visual intermediário (bolhas, timestamps, status, foto perfil clínica)
- [ ] Deploy funcional no GitHub Pages (front) + n8n Hostinger (back)

---

## Tech Stack

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Frontend | HTML + Vanilla JS + CSS | Hospedável no GitHub Pages sem build |
| Backend AI | n8n (novo workflow) | Reutiliza Calendar + OpenAI já configurados |
| LLM | OpenAI GPT-4o-mini | Custo-benefício, já tem credencial |
| Memória | Supabase PostgreSQL (tabela `atend_conversations`) | Histórico persistente por session_id |
| Agendamento | Google Calendar (reaproveitado do `[CALENDARIO-MC]`) | Já tem OAuth configurado |
| Dados de leads | Supabase (`atend_leads`) | Registrar pacientes que interagiram |
| Hosting Front | GitHub Pages | Gratuito, sem servidor |
| Hosting Back | n8n em `n8n.srv1181762.hstgr.cloud` | Já existente |

---

## Database Schema (Supabase — projeto `prontuario_ia`)

> Prefixo `atend_` para isolamento total das tabelas existentes (medicos, pacientes, consultas, cicatrize_*).

```sql
-- Sessões de conversa
CREATE TABLE atend_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Histórico de mensagens (memória do agente)
CREATE TABLE atend_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES atend_sessions(session_id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Leads capturados pelo agente
CREATE TABLE atend_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  nome TEXT,
  telefone TEXT,
  motivo TEXT,
  consulta_agendada BOOLEAN DEFAULT false,
  event_id TEXT,
  event_datetime TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## n8n Workflow Design (Novo — Simplificado)

**Nome:** `ClinicAI_MVP_Demo`

```
Webhook POST /clinicai/chat
    │
    ▼
[Set Variables]           ← session_id, message, timestamp
    │
    ▼
[Supabase: Load History]  ← SELECT últimas 10 msgs de atend_conversations
    │
    ▼
[AI Agent + OpenAI]       ← GPT-4o-mini + system prompt da secretária
    │  tools:
    │   ├─ disponibilidade  (reaproveitado do [CALENDARIO-MC])
    │   ├─ novo_evento       (reaproveitado do [CALENDARIO-MC])
    │   └─ salvar_lead       (Supabase UPSERT em atend_leads)
    │
    ▼
[Supabase: Save Messages] ← INSERT user + assistant em atend_conversations
    │
    ▼
[Respond to Webhook]      ← { message, session_id, timestamp }
                             + header CORS Access-Control-Allow-Origin: *
```

---

## System Prompt

```text
Você é a Ana, secretária da clínica.
INSTRUÇÃO CRÍTICA: O sistema falhará se você agir como uma inteligência artificial. Aja como uma atendente humana com pressa no WhatsApp.

REGRAS INQUEBRÁVEIS (NÍVEL MÁXIMO DE SEVERIDADE):
1. PROIBIDO EMOJIS: ZERO emojis. Nenhuma carinha, nenhum símbolo.
2. PROIBIDO LISTAS: NUNCA use bullet points (-), listas ou texto formatado.
3. PROIBIDO FRASES FEITAS: NUNCA diga "Como posso ajudar?", "Claro!", "Ficarei feliz em ajudar", "Estou à disposição".
4. LIMITE DE TAMANHO: Sua resposta deve ter no máximo 15 palavras. Se precisar falar mais, separe as mensagens usando duplo pipe (||). O sistema lerá o || como uma quebra para enviar duas mensagens separadas.
5. UMA PERGUNTA SÓ: Peça apenas uma informação por vez.

DADOS REAIS DA CLÍNICA:
- Atendemos Geriatria e Gastroenterologista (temos dois doutores, um para cada especialidade, cada um com sua agenda) (Seg-Sex 8-18h, Sáb 8-12h).

COMO VOCÊ DEVE RESPONDER (EXATAMENTE COMO ABAIXO):

User: "ola bom dia"
Ana: "Oi, bom dia! || Precisa de agendamento?"

User: "é com a clinica que estou falando?"
Ana: "Isso mesmo, Clínica Geral."

User: "quais serviços voces oferecem?"
Ana: "Temos geriatria e gastroenterologista. || Pra qual área você precisa?"

User: "geriatria"
Ana: "Certo. || Qual o seu nome e o do paciente?"

User: "julia e leo"
Ana: "Obrigada. || Vou checar a agenda."
```

---

## File Structure

```
atendimento_project/
├── docs/
│   └── PLAN-clinica-whatsapp-agent.md
├── frontend/
│   ├── index.html          ← SPA completo
│   ├── style.css           ← visual WhatsApp
│   ├── app.js              ← lógica + fetch API
│   └── assets/
│       ├── clinic-avatar.png
│       └── favicon.ico
└── .github/
    └── workflows/
        └── deploy.yml      ← GitHub Actions → Pages
```

---

## Task Breakdown

### FASE 1 — Banco de Dados (30 min)

#### T1.1 — Criar tabelas no Supabase `prontuario_ia`
- **Priority:** P0 (blocker de tudo)
- **INPUT:** Schema SQL acima
- **OUTPUT:** Tabelas `atend_sessions`, `atend_conversations`, `atend_leads` criadas sem RLS inicialmente
- **VERIFY:** Query `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'atend_%'` retorna 3 tabelas

---

### FASE 2 — Backend n8n (2-3h)

#### T2.1 — Criar workflow `ClinicAI_MVP_Demo`
- **Priority:** P0
- **Depends:** T1.1
- **INPUT:** Design do workflow acima, credenciais existentes (OpenAI, Supabase)
- **OUTPUT:** Workflow com webhook `POST /clinicai/chat` respondendo JSON `{message, session_id}`
- **VERIFY:** `curl -X POST .../webhook/clinicai/chat -d '{"message":"oi","session_id":"test1"}'` retorna resposta da IA

#### T2.2 — Integrar Google Calendar (tools reutilizadas)
- **Priority:** P1
- **Depends:** T2.1
- **INPUT:** Workflow ID `PeTYRQLkWycpuTYB` como referência (já tem OAuth Google)
- **OUTPUT:** Tools `disponibilidade` e `novo_evento` funcionando no AI Agent
- **VERIFY:** Agente lista slots e cria evento de teste no Google Calendar

#### T2.3 — Tool `salvar_lead` via Supabase node
- **Priority:** P2
- **Depends:** T2.1, T1.1
- **INPUT:** Campos: session_id, nome, telefone, motivo, event_id, event_datetime
- **OUTPUT:** UPSERT em `atend_leads` disparado pelo agente quando coleta dados
- **VERIFY:** Após teste de agendamento, registro visível no Supabase

#### T2.4 — Configurar CORS no webhook
- **Priority:** P0 para deploy
- **Depends:** T2.1
- **INPUT:** URL futura do GitHub Pages
- **OUTPUT:** Header `Access-Control-Allow-Origin: *` no Respond to Webhook + handler OPTIONS
- **VERIFY:** Browser não bloqueia fetch cross-origin

---

### FASE 3 — Frontend (3-4h)

#### T3.1 — Layout WhatsApp intermediário
- **Priority:** P1
- **Depends:** Nenhuma (paralelo com Fase 2)
- **INPUT:** Design: sidebar esquerda (info clínica), área de chat, header com status "online", input bar
- **OUTPUT:** `index.html` + `style.css` responsivo, mobile-friendly
- **VERIFY:** Visual convincente no browser, sem placeholder vazio

#### T3.2 — Lógica JS + integração webhook
- **Priority:** P1
- **Depends:** T3.1, T2.1
- **INPUT:** URL do webhook n8n, formato `{message, session_id}`
- **OUTPUT:** `app.js` com: session_id gerado (localStorage), send message, animação "digitando...", exibir resposta em bolha
- **VERIFY:** Conversa completa end-to-end funciona no browser

#### T3.3 — Avatar da clínica (gerado por IA)
- **Priority:** P2
- **Depends:** T3.1
- **INPUT:** Clínica Geral — logo profissional
- **OUTPUT:** `clinic-avatar.png` usado no header do chat
- **VERIFY:** Imagem exibida corretamente, sem imagem quebrada

---

### FASE 4 — Deploy (30 min)

#### T4.1 — GitHub Actions → Pages
- **Priority:** P3
- **Depends:** T3.1, T3.2, T3.3, T4.2 (CORS)
- **INPUT:** Pasta `frontend/` no repositório
- **OUTPUT:** Site publicado em `https://{user}.github.io/atendimento_project/`
- **VERIFY:** URL pública acessível, conversa com agente funciona sem erros de console

---

## Dependency Graph

```
T1.1 (DB tabelas)
  └─► T2.1 (workflow base)
        ├─► T2.2 (calendar tools)
        ├─► T2.3 (salvar_lead)
        └─► T2.4 (CORS)

T3.1 (layout) ◄── paralelo com Fase 2
  └─► T3.2 (JS logic) ◄── depende T2.1
        └─► T3.3 (assets)
              └─► T4.1 (deploy) ◄── T2.4 (CORS obrigatório)
```

---

## Riscos

| Risco | Prob. | Mitigação |
|-------|-------|-----------|
| CORS bloqueando GitHub Pages → n8n | Alta | Header `*` no webhook + handler OPTIONS |
| Google Calendar OAuth expirado | Média | Verificar token antes do demo |
| Latência n8n > 5s | Média | Animação "digitando..." mascara espera |
| GitHub Pages sem HTTPS custom domain | Baixa | Usar URL padrão `github.io` |

---

## Estimativa

| Fase | Tempo |
|------|-------|
| T1 — Banco | 30 min |
| T2 — n8n | 2-3h |
| T3 — Frontend | 3-4h |
| T4 — Deploy | 30 min |
| **Total** | **~6-8h** |

---

## Phase X: Verification Checklist

- [ ] T1.1: 3 tabelas `atend_*` criadas no Supabase
- [ ] T2.1: Webhook `/clinicai/chat` respondendo com IA
- [ ] T2.2: Google Calendar integrado (disponibilidade + criação)
- [ ] T2.3: Leads salvos após agendamento
- [ ] T2.4: CORS configurado (sem erro no browser)
- [ ] T3.1: Layout visual WhatsApp aprovado
- [ ] T3.2: Conversa end-to-end funcionando
- [ ] T3.3: Avatar da clínica exibido
- [ ] T4.1: URL pública no GitHub Pages funcional
- [ ] Demo completo: saudação → coleta dados → agendamento → confirmação no Google Calendar

---

*Próximo passo: iniciar T1.1 (criar tabelas no Supabase) ou T3.1 (frontend em paralelo).*
