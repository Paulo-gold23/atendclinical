# 🏥 AtendClinical — Agente IA de Atendimento Clínico via WhatsApp

**AtendClinical** é um sistema inteligente de agendamento e atendimento clínico via WhatsApp, construído com automação n8n, banco de dados Supabase e interface de demonstração web.

---

## 🏗️ Arquitetura

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   WhatsApp API   │◄──►│     n8n Cloud     │◄──►│    Supabase DB   │
│  (Evolution API) │    │  (Workflow Engine) │    │  (PostgreSQL)    │
└──────────────────┘    └────────┬───────────┘    └──────────────────┘
                                 │
                        ┌────────▼───────────┐
                        │  Google Calendar   │
                        │  (Agenda Médica)   │
                        └────────────────────┘
```

| Camada      | Tecnologia                       | Hospedagem        |
|-------------|----------------------------------|-------------------|
| **Backend** | n8n (workflows de automação)     | n8n Cloud         |
| **Banco**   | PostgreSQL via Supabase          | Supabase Cloud    |
| **Agenda**  | Google Calendar API (OAuth 2.0)  | Google Cloud      |
| **Canal**   | WhatsApp via Evolution API       | VPS / Cloud       |
| **Frontend**| HTML/CSS/JS (demo interface)     | GitHub Pages      |

---

## 📂 Estrutura do Projeto

```
atendclinical/
├── frontend/           # Interface de demonstração WhatsApp
│   ├── index.html      # Página principal
│   ├── style.css       # Estilos (glassmorphism, dark mode)
│   ├── app.js          # Lógica de interação
│   └── assets/         # Imagens e recursos
├── docs/               # Documentação e prompts do agente
│   ├── PLAN-clinica-whatsapp-agent.md
│   ├── SDR MAIN PROMPT.md
│   ├── SECRETARIA TOOL PROMPT.md
│   └── PROMPT_FARMA.md
├── .gitignore
└── README.md
```

---

## 🤖 Funcionalidades do Agente

- ✅ **Agendamento inteligente** — O agente verifica disponibilidade no Google Calendar e agenda consultas
- ✅ **Cancelamento de consultas** — Busca e cancela consultas existentes
- ✅ **Multi-especialidade** — Suporte a múltiplos médicos e especialidades
- ✅ **Memória conversacional** — Mantém contexto durante toda a conversa
- ✅ **Coleta de dados** — Captura nome, CPF, convênio/particular automaticamente
- ✅ **Link de confirmação** — Envia link do Google Calendar para o paciente

---

## 🚀 Deploy

O backend roda inteiramente na nuvem:

1. **n8n Cloud** — Workflows de automação e IA
2. **Supabase** — Banco de dados PostgreSQL gerenciado
3. **Google Calendar** — Agenda médica integrada

A interface demo pode ser hospedada no **GitHub Pages** ou qualquer servidor estático.

---

## 📝 Licença

Projeto privado — Todos os direitos reservados.
