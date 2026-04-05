import Anthropic from '@anthropic-ai/sdk'
import {
  ALLOWED_CLINIC_VERTICALS,
  KNOWLEDGE_ITEM_BODY_MAX_CHARS,
  KNOWLEDGE_ITEMS_MAX_COUNT,
} from '@/lib/clinic-call-ai'
import type { ClinicVertical, VoiceKnowledgeItem } from '@/lib/types'

const DEFAULT_MODEL = 'claude-haiku-4-5'
const MAX_MARKDOWN_CHARS = 56_000

export type BusinessUrlAnalysisResult = {
  businessName: string
  vertical: ClinicVertical
  description: string | null
  locations: string[]
  sizeOrScaleHint: string | null
  websiteUrl: string
  confidenceNotes: string | null
  /** Suggested knowledge cards (title + body) for the receptionist setup */
  knowledgeItems: Pick<VoiceKnowledgeItem, 'title' | 'body'>[]
}

function getAnthropicClient(): Anthropic {
  const key = process.env.CALUDE_CALL_SUMMARY_KEY1 || process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error('Missing CALUDE_CALL_SUMMARY_KEY1 or ANTHROPIC_API_KEY')
  }
  return new Anthropic({ apiKey: key })
}

export function normalizeBusinessWebsiteUrl(input: string): string {
  const t = input.trim()
  if (!t) {
    throw new Error('URL is required')
  }
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`
  let u: URL
  try {
    u = new URL(withProto)
  } catch {
    throw new Error('Invalid URL')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported')
  }
  return u.toString()
}

type TavilyExtractJson = {
  results?: { url?: string; raw_content?: string }[]
  failed_results?: { url?: string; error?: string }[]
  detail?: { error?: string }
}

export async function tavilyExtractMarkdown(url: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY
  if (!key) {
    throw new Error('Missing TAVILY_API_KEY')
  }

  const res = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      urls: url,
      format: 'markdown',
      extract_depth: 'advanced',
    }),
  })

  const json = (await res.json().catch(() => ({}))) as TavilyExtractJson
  if (!res.ok) {
    const msg = json.detail?.error || (typeof json === 'object' && json !== null && 'error' in json ? String((json as { error?: unknown }).error) : null)
    throw new Error(typeof msg === 'string' && msg ? msg : 'Tavily extract failed')
  }

  const first = json.results?.[0]
  const text = typeof first?.raw_content === 'string' ? first.raw_content.trim() : ''
  if (text) {
    return text.length > MAX_MARKDOWN_CHARS ? text.slice(0, MAX_MARKDOWN_CHARS) : text
  }

  const fail = json.failed_results?.[0]?.error
  throw new Error(fail?.trim() || 'No content could be extracted from this URL')
}

function coerceVertical(raw: unknown): ClinicVertical {
  const s = typeof raw === 'string' ? raw.toLowerCase().trim() : ''
  return (ALLOWED_CLINIC_VERTICALS as readonly string[]).includes(s) ? (s as ClinicVertical) : 'general'
}

function businessProfileTool(): Anthropic.Messages.Tool {
  return {
    name: 'submit_business_profile',
    description: 'Return structured fields inferred from the website content only.',
    input_schema: {
      type: 'object',
      properties: {
        business_name: {
          type: 'string',
          description: 'Official or brand name of the business (not the domain).',
        },
        vertical: {
          type: 'string',
          enum: [...ALLOWED_CLINIC_VERTICALS],
          description: 'Best-fit vertical for this product.',
        },
        description: {
          type: ['string', 'null'],
          description: 'One or two sentences on what the business does.',
        },
        locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'City/region names or clinic names if clearly stated; else [].',
        },
        size_or_scale_hint: {
          type: ['string', 'null'],
          description: 'e.g. number of locations, “single practice”, “health system” if evident.',
        },
        confidence_notes: {
          type: ['string', 'null'],
          description: 'Brief caveats if the page is thin, ambiguous, or not a business site.',
        },
        knowledge_items: {
          type: 'array',
          description: [
            `Up to ${KNOWLEDGE_ITEMS_MAX_COUNT} separate knowledge cards for an AI phone receptionist.`,
            'Extract EVERYTHING useful from the page: split into many focused cards rather than a few shallow ones.',
            'Cover: legal business name; what they do; all services/specialties/programs; providers/team names and roles if listed;',
            'hours by location or department; after-hours / emergency; appointments (how to book, new vs existing, referrals, wait times);',
            'all locations with addresses/directions/parking/transit if stated; contact phones/emails/fax only if on the page;',
            'insurance accepted / payment / financing; forms and what to bring; policies (cancellation, no-show, privacy);',
            'languages; accessibility; FAQs; pricing if stated; scope of practice and what they do NOT treat if stated.',
            'Each card body should be long and detailed (bullet lists OK) so callers get accurate answers—do not summarize away specifics.',
            'Only facts supported by the markdown; never invent contact info or claims not present.',
          ].join(' '),
          maxItems: KNOWLEDGE_ITEMS_MAX_COUNT,
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Specific label, e.g. "Insurance & billing", "Dr. Smith — orthopedics", "Main office — hours & parking"',
              },
              body: {
                type: 'string',
                description: `Full detail for this topic (plain text or markdown). Target up to ~${Math.round(KNOWLEDGE_ITEM_BODY_MAX_CHARS / 1000)}k characters when the source has that much; include names, numbers, and steps from the page.`,
              },
            },
            required: ['title', 'body'],
          },
        },
      },
      required: [
        'business_name',
        'vertical',
        'description',
        'locations',
        'size_or_scale_hint',
        'confidence_notes',
        'knowledge_items',
      ],
    },
  }
}

const SYSTEM = `You help create a business record and exhaustive receptionist knowledge from a single webpage (markdown from Tavily extract).
Rules:
- Use ONLY the provided markdown. Do not invent addresses, phone numbers, or claims not supported by the text.
- If the page is not clearly a business (e.g. parked domain, error page), still call the tool with your best guess and explain in confidence_notes.
- vertical must be one of the enum values; pick general when unsure.
- business_name should be the human-facing brand, not the raw hostname unless that is clearly the brand.
- knowledge_items: MAXIMIZE coverage for phone AI context. Prefer many focused cards over a few vague ones.
  Each body should pack in every relevant fact from the page for that topic (lists, hours, names, criteria, steps).
  Omit only empty or redundant cards. Never invent phone numbers or addresses not on the page.`

export async function analyzeBusinessFromWebsiteMarkdown(
  websiteUrl: string,
  markdown: string
): Promise<BusinessUrlAnalysisResult> {
  const model =
    process.env.ANTHROPIC_BUSINESS_URL_MODEL ??
    process.env.ANTHROPIC_CALL_MODEL ??
    DEFAULT_MODEL
  const client = getAnthropicClient()

  const user = [
    `Website URL: ${websiteUrl}`,
    'Page content (markdown):',
    '---',
    markdown,
    '---',
    'Call submit_business_profile with your analysis.',
  ].join('\n')

  const message = await client.messages.create({
    model,
    max_tokens: 16384,
    system: SYSTEM,
    tools: [businessProfileTool()],
    tool_choice: { type: 'tool', name: 'submit_business_profile' },
    messages: [{ role: 'user', content: user }],
  })

  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'submit_business_profile') {
      const raw = block.input as Record<string, unknown>
      const name =
        typeof raw.business_name === 'string' && raw.business_name.trim()
          ? raw.business_name.trim()
          : new URL(websiteUrl).hostname.replace(/^www\./, '')
      const locations = Array.isArray(raw.locations)
        ? raw.locations.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 20)
        : []
      const knowledgeItems: Pick<VoiceKnowledgeItem, 'title' | 'body'>[] = []
      if (Array.isArray(raw.knowledge_items)) {
        for (const row of raw.knowledge_items) {
          if (!row || typeof row !== 'object') continue
          const o = row as Record<string, unknown>
          const t = typeof o.title === 'string' ? o.title.trim() : ''
          const b = typeof o.body === 'string' ? o.body.trim() : ''
          if (!t || !b) continue
          knowledgeItems.push({
            title: t.slice(0, 200),
            body: b.slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS),
          })
          if (knowledgeItems.length >= KNOWLEDGE_ITEMS_MAX_COUNT) break
        }
      }
      return {
        businessName: name,
        vertical: coerceVertical(raw.vertical),
        description: typeof raw.description === 'string' ? raw.description.trim() || null : null,
        locations,
        sizeOrScaleHint:
          typeof raw.size_or_scale_hint === 'string' ? raw.size_or_scale_hint.trim() || null : null,
        websiteUrl,
        confidenceNotes:
          typeof raw.confidence_notes === 'string' ? raw.confidence_notes.trim() || null : null,
        knowledgeItems,
      }
    }
  }

  throw new Error('Claude did not return submit_business_profile tool output')
}

export async function analyzeBusinessFromWebsiteUrl(rawUrl: string): Promise<BusinessUrlAnalysisResult> {
  const websiteUrl = normalizeBusinessWebsiteUrl(rawUrl)
  const markdown = await tavilyExtractMarkdown(websiteUrl)
  return analyzeBusinessFromWebsiteMarkdown(websiteUrl, markdown)
}
