# Peptlas MCP server: is this peptide legal?

Ask Claude, ChatGPT, Cursor or any MCP client whether a peptide is legal, and it answers from [Peptlas](https://peptlas.com/), the peptide legal status atlas. You get the status in the United States (FDA), Australia (TGA), the UK (MHRA), the EU (EMA), Canada (Health Canada), Brazil (ANVISA) and sport (WADA), with the primary source and the date it was last verified.

Free, read-only, no account. Setup guide: [peptlas.com/mcp-server](https://peptlas.com/mcp-server/).

## Connect

The hosted server needs no install:

```
https://peptlas.com/mcp
```

- **Claude** (claude.ai and the desktop app): Settings, then Connectors, then Add custom connector, with the address above.
- **Claude Code:** `claude mcp add --transport http peptlas https://peptlas.com/mcp`
- **Cursor** (`.cursor/mcp.json`) and other clients that read `mcpServers`:

  ```json
  { "mcpServers": { "peptlas": { "url": "https://peptlas.com/mcp" } } }
  ```

- **VS Code** (`.vscode/mcp.json`):

  ```json
  { "servers": { "peptlas": { "type": "http", "url": "https://peptlas.com/mcp" } } }
  ```

- **Local (stdio)**, for clients that only run local servers: `npx -y github:Peptlas/peptlas-mcp`. It loads the current data from peptlas.com once at start-up.

## Tools

| Tool | Answers |
|---|---|
| `check_legal_status` | Is this peptide legal? One compound or blend (KLOW, GLOW, the Wolverine stack), everywhere Peptlas tracks or in one place you name, with the U.S. answer in full (compounding rules, the latest FDA advisory vote, the next dated event), primary sources and the date it was last verified. |
| `status_in_place` | What is legal in a country? Every tracked compound in one place: a country, region, EU member state, regulator or "sport". |
| `list_compounds` | The compounds Peptlas tracks, with the names people search by: brands, codes and street names. |
| `recent_changes` | Dated regulatory events, newest first: FDA votes, list changes, comment deadlines, warning letters. |

Compounds resolve by name, brand, code or street name ("BPC-157", "Ozempic", "TB500", "reta"), and blends by their sellers' names ("KLOW", "GLOW 70", "Wolverine stack"). A blend is never more legal than its least legal ingredient, so each place takes its strictest one. All tools are read-only.

## Try asking

- Is BPC-157 legal in Australia?
- Is KLOW legal in the UK?
- Can a U.S. pharmacy still compound semaglutide?
- Which peptides does WADA ban?
- What changed with retatrutide this month?

## Compounds covered

Each name links to its page on peptlas.com, with every primary source:

[BPC-157](https://peptlas.com/entries/bpc-157/) · [Cagrilintide](https://peptlas.com/entries/cagrilintide/) · [CJC-1295](https://peptlas.com/entries/cjc-1295/) · [Emideltide (DSIP)](https://peptlas.com/entries/emideltide/) · [Epitalon](https://peptlas.com/entries/epitalon/) · [GHK-Cu](https://peptlas.com/entries/ghk-cu/) · [Ipamorelin](https://peptlas.com/entries/ipamorelin/) · [KPV](https://peptlas.com/entries/kpv/) · [Melanotan II](https://peptlas.com/entries/melanotan-2/) · [MOTS-c](https://peptlas.com/entries/mots-c/) · [NAD+](https://peptlas.com/entries/nad-plus/) · [Retatrutide](https://peptlas.com/entries/retatrutide/) · [Selank](https://peptlas.com/entries/selank/) · [Semaglutide](https://peptlas.com/entries/semaglutide/) (Ozempic, Wegovy) · [Semax](https://peptlas.com/entries/semax/) · [Sermorelin](https://peptlas.com/entries/sermorelin/) · [TB-500](https://peptlas.com/entries/tb-500/) · [Thymosin Alpha-1](https://peptlas.com/entries/thymosin-alpha-1/) · [Tirzepatide](https://peptlas.com/entries/tirzepatide/) (Mounjaro, Zepbound)

Blends, worked out from their ingredients: [KLOW](https://peptlas.com/blends/klow/) · [GLOW](https://peptlas.com/blends/glow/) · [Wolverine stack](https://peptlas.com/blends/wolverine-stack/) ([all blends](https://peptlas.com/blends/)). Pending FDA decision: [Is CagriSema approved?](https://peptlas.com/cagrisema-fda-approval/)

The short answer for all of them is on [Are peptides legal?](https://peptlas.com/are-peptides-legal/). Every status side by side is in the [country-by-country grid](https://peptlas.com/peptide-status-by-country/). Brazil has its own [Portuguese pages](https://peptlas.com/pt-br/).

## The data

The answers come from the same data as every page on peptlas.com: [atlas.json](https://peptlas.com/data/atlas.json), rebuilt with each update.

- **How it's kept current:** official sources are checked every six hours, and no status changes until a person has checked the primary source ([how Peptlas tracks it](https://peptlas.com/methodology/)). Every change is dated in the [public changelog](https://peptlas.com/changelog/).
- **Data:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit Peptlas and link the compound page.
- **Code:** MIT.
- **Not advice:** the statuses describe the law, not safety, efficacy or dosing. Nothing here is legal or medical advice, and Peptlas recommends no products or sellers.
- **Privacy:** no account, no cookies. Your questions are neither stored nor logged by Peptlas.

The hosted endpoint runs this code (`src/`) as a Cloudflare Pages Function. It is listed in the official MCP Registry as `com.peptlas/legal-status`.

---

Made by the Peptlas Research Team. [peptlas.com](https://peptlas.com/) is the neutral, source-linked atlas of peptide legal status.
