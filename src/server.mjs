// The Peptlas MCP server: four read-only tools over the atlas. One factory serves the Pages
// Function (functions/mcp.ts), the tests and the build-time smoke check.
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { checkLegalStatus, statusInPlace, listCompounds, recentChanges, ToolInputError } from './tools.mjs';

export const VERSION = '1.0.0';
export const DOCS_URL = 'https://peptlas.com/mcp-server/';

const STATUSES = ['compounding_legal', 'under_review', 'in_limbo', 'restricted', 'unscheduled'];

const INSTRUCTIONS = [
  'Peptlas tracks the legal status of peptides and GLP-1 drugs (BPC-157, TB-500, semaglutide, tirzepatide, retatrutide and more)',
  'with the FDA, TGA, MHRA, EMA, Health Canada, ANVISA and WADA. Every status is dated and linked to its primary source.',
  'Use check_legal_status for "is X legal (in Y)?", status_in_place for "what is legal in Y?", recent_changes for news,',
  'and list_compounds to see what is covered. Quote the status label and its date, link the page from the result,',
  'and credit Peptlas (peptlas.com, CC BY 4.0). Statuses describe the law, not safety, efficacy or dosing:',
  'Peptlas gives no medical or legal advice and recommends no products or sellers.',
].join(' ');

const ok = (result) => ({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result });

/** A question the tools can't answer as asked comes back as a tool error that says what would work. */
function answer(run) {
  try {
    return ok(run());
  } catch (e) {
    if (e instanceof ToolInputError) return { content: [{ type: 'text', text: e.message }], isError: true };
    throw e;
  }
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const compound = z
  .string()
  .min(1)
  .max(100)
  .describe('A compound by name, brand, code or street name: "BPC-157", "Ozempic", "tirzepatide", "reta", "TB500".');
const place = z
  .string()
  .min(1)
  .max(60)
  .describe('A country, region or regulator: "Australia", "UK", "Germany" (EU), "Brazil", "FDA", or "sport" for WADA.');

/** @param {any} atlas the parsed /data/atlas.json */
export function createServer(atlas) {
  const server = new McpServer(
    {
      name: 'peptlas',
      title: 'Peptlas: is this peptide legal?',
      version: VERSION,
      websiteUrl: DOCS_URL,
      icons: [
        { src: 'https://peptlas.com/favicon.svg', mimeType: 'image/svg+xml', sizes: ['any'] },
        { src: 'https://peptlas.com/brand/peptlas-mark-512.png', mimeType: 'image/png', sizes: ['512x512'] },
      ],
    },
    {
      instructions: INSTRUCTIONS,
      // The tool list only changes with a release.
      cacheHints: { 'tools/list': { ttlMs: 3_600_000, cacheScope: 'public' }, 'server/discover': { ttlMs: 3_600_000, cacheScope: 'public' } },
    },
  );

  server.registerTool(
    'check_legal_status',
    {
      title: 'Is this peptide legal?',
      description:
        'The legal status of one peptide or GLP-1 drug in the United States (FDA), Australia (TGA), the UK (MHRA), the EU (EMA), Canada (Health Canada), ' +
        'Brazil (ANVISA, where covered) and sport (WADA), or in the one place you name. Returns each status with a plain-language note; for the U.S. also ' +
        'the full answer (compounding rules, the latest FDA advisory vote, the next dated event), plus primary sources and the date it was last verified.',
      inputSchema: z.object({ compound, place: place.optional().describe(`${place.description} Omit it for every place.`) }),
      annotations: readOnly,
    },
    (args) => answer(() => checkLegalStatus(atlas, args)),
  );

  server.registerTool(
    'status_in_place',
    {
      title: 'What is legal in a country?',
      description:
        'Every tracked peptide in one place, with its status and a note: use it for "which peptides are legal in Australia" or "what does WADA ban". ' +
        'Optionally only one status.',
      inputSchema: z.object({
        place,
        status: z.enum(STATUSES).optional().describe('Only this status: compounding_legal, under_review, in_limbo, restricted or unscheduled.'),
      }),
      annotations: readOnly,
    },
    (args) => answer(() => statusInPlace(atlas, args)),
  );

  server.registerTool(
    'list_compounds',
    {
      title: 'List compounds',
      description:
        `The ${atlas.compounds.length} compounds Peptlas tracks, with the names people search by (brands, codes, street names), each U.S. status and its page. ` +
        'Use it to see what is covered.',
      inputSchema: z.object({ us_status: z.enum(STATUSES).optional().describe('Only compounds with this U.S. status.') }),
      annotations: readOnly,
    },
    (args) => answer(() => listCompounds(atlas, args)),
  );

  server.registerTool(
    'recent_changes',
    {
      title: 'Recent changes',
      description:
        'Dated regulatory events from the Peptlas changelog, newest first: FDA advisory votes, list changes, comment deadlines, warning letters. ' +
        'Optionally for one compound or since a date. Use it for "what changed" or "any news on BPC-157".',
      inputSchema: z.object({
        compound: compound.optional().describe('Only this compound. Omit it for every compound.'),
        since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Only events on or after this date (YYYY-MM-DD).'),
        limit: z.number().int().min(1).max(50).default(10).describe('How many events, newest first (1-50).'),
      }),
      annotations: readOnly,
    },
    (args) => answer(() => recentChanges(atlas, args)),
  );

  return server;
}
