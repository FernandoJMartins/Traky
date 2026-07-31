# Utmify (clone) — Rastreamento de Vendas & Atribuição

SaaS estilo **Utmify**: rastreia vendas do checkout (via webhook 1:1 compatível com a Utmify), cruza com o gasto da **Meta Ads** por UTMs e mostra **ROI / ROAS / lucro** por conta → campanha → conjunto → anúncio.

- **Stack:** Next.js 16 (App Router) + TypeScript, PostgreSQL + Drizzle ORM, Tailwind v4 + Recharts. Dark-first.
- **Infra:** Docker Compose (Postgres na porta **5433** no host; Redis já disponível para filas futuras).
- **Auth:** sessão via cookie assinado (HMAC/`AUTH_SECRET`), senha com scrypt.

## Rodando

```bash
docker compose up -d          # Postgres (5433) + Redis
# aplicar migrações em drizzle/*.sql (via docker exec ... psql)
npm run dev                   # http://localhost:3000
```

> **Gotcha (OneDrive + Turbopack):** rotas/arquivos novos e mudanças no `.env` só valem **após reiniciar o dev server**. Valide rota nova com `curl`.

---

## Fonte de verdade dos dados

| Dado | Fonte |
|---|---|
| Vendas (aprovadas/pendentes), faturamento, taxas | **Nosso banco** (`sales`, via webhook 1:1 Utmify) |
| Imposto Meta Ads (12,5%) | Calculado no banco a partir do gasto |
| Gasto, impressões, cliques, CPM | **Meta Ads** (só mídia) |
| Orçamento, bid, status, estrutura | **Meta Ads** |

A Meta **não** é fonte de vendas — o "faturamento" dela é só o que o nosso pixel/CAPI devolveu (redundante, atrasado e re-atribuído). A fonte real é o gateway/checkout.

---

## Sincronização com a Meta — estratégia de rate limit

O app puxa gasto + estrutura (campanhas/conjuntos/anúncios) da Meta. Isso acontece de duas formas:

1. **Manual:** botão **Sincronizar** na navbar (sob demanda).
2. **Agendado (background):** um worker in-process puxa periodicamente, pra manter os dados frescos **mesmo com o usuário offline** — requisito das **Regras de Otimização**.

### Limites da Meta (por CONTA de anúncio, por hora)

App no **Dev tier** (não verificado):

| Tipo | Dev tier | Standard tier (App Review) |
|---|---|---|
| `ads_insights` | `600 + 400 × anúncios ativos` | `190.000 + 400 × ativos − 0,001 × erros` |
| `ads_management` | `300 + 40 × anúncios ativos` | `100.000 + 40 × ativos` |

### Quanto gastamos

Um sync completo = **~6 chamadas por conta** (3 insights: campanha/conjunto/anúncio + 3 management: listar campanhas/conjuntos/anúncios).

Sincronizando **a cada 10 min** (6×/h): **~36 chamadas/conta/h** → ~18 insights (de 600) e ~18 management (de 300) = **~5-6% da cota**. Sobra folga inclusive para os writes das Regras de Otimização (pause/orçamento contam em `ads_management`).

### O risco real não é a cota — é parecer robô

O bloqueio que já sofremos foi o detector de bot reagindo a **rajadas** de chamadas de teste. Mitigações implementadas:

- **Só contas ATIVAS** (toggle em Integrações) e **campanhas com atividade** no período.
- **Escalonamento:** contas processadas uma a uma, com intervalo (`SYNC_STAGGER_MS`), nunca todas de uma vez.
- **Auto-throttle por header:** lemos `X-Business-Use-Case-Usage` / `X-App-Usage` e desaceleramos quando o uso passa de ~75%.
- **Backoff:** se a Meta retornar `estimated_time_to_regain_access > 0`, o sync espera esse tempo.
- **Chamadas paralelas só dentro da mesma conta** (2 ondas), nunca varrendo todas as contas em paralelo.

### Configuração (`.env`)

| Var | Default | Descrição |
|---|---|---|
| `SYNC_ENABLED` | `true` | Liga/desliga o sync agendado |
| `SYNC_INTERVAL_MIN` | `10` | Intervalo entre ciclos (minutos) |
| `SYNC_STAGGER_MS` | `1500` | Pausa entre contas dentro de um ciclo |
| `SYNC_DAYS` | `30` | Janela de dias puxada da Meta |

Escalar para o **Standard tier** (App Review) remove qualquer preocupação de cota, mas não é necessário para o volume atual.

### Referências

- [Rate Limiting — Marketing API](https://developers.facebook.com/docs/marketing-api/overview/rate-limiting/)
- [Rate Limits — Graph API](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)
- [Limits & Best Practices — Insights](https://developers.facebook.com/docs/marketing-api/insights/best-practices/)

---

## Roadmap

- [x] Dashboard, API de vendas (1:1 Utmify), integração Meta, pixels/CAPI, multi-dashboard
- [x] Central de campanhas (contas→campanhas→conjuntos→anúncios, escrita na Meta, orçamento/bid)
- [x] Relatório de UTMs, Premiações, Notificações + PWA, Login + Landing
- [x] **Sync agendado em background** (fundação para as Regras)
- [ ] **Regras de Otimização** (engine que age sobre as campanhas com base em performance)
- [ ] Planos/assinatura
