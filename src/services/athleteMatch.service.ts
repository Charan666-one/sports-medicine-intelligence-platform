import { db } from './db.js';
import { logger } from '../utils/logger.js';

export interface AthleteMatchResult {
  athleteId: string;
  athleteName: string;
  matched: boolean; // true = linked to an existing athlete, false = newly created
  detectedName: string | null;
}

/**
 * Resolves which athlete an uploaded report belongs to, without the user having
 * to pre-select one. It detects a candidate name from the parsed document text
 * (preferred) or the file name, then matches an existing athlete or creates a
 * new record.
 */
export class AthleteMatchService {
  /** Tokens that appear in report file names but are not part of a person's name. */
  private static NOISE = new Set([
    'report', 'reports', 'blood', 'urine', 'lab', 'labs', 'result', 'results',
    'test', 'tests', 'panel', 'passport', 'biological', 'medical', 'sample',
    'specimen', 'final', 'copy', 'scan', 'ocr', 'pdf', 'csv', 'image', 'doping',
    'anti', 'wada', 'adams', 'v1', 'v2', 'draft',
  ]);

  static async resolve(params: {
    fileName: string;
    rawText?: string;
    organizationId?: string;
  }): Promise<AthleteMatchResult> {
    const detected =
      this.detectFromText(params.rawText) ?? this.detectFromFileName(params.fileName);

    // 1. Try to match an existing athlete by normalised name — scoped to the
    //    uploader's organization so a report can never attach to another
    //    tenant's athlete.
    if (detected) {
      const existing = await this.findExisting(detected, params.organizationId);
      if (existing) {
        logger.info(`🔗 Matched upload to existing athlete "${existing.name}" (${existing.id})`);
        return {
          athleteId: existing.id,
          athleteName: existing.name,
          matched: true,
          detectedName: detected,
        };
      }
    }

    // 2. Create a new athlete record for the detected (or an "Unidentified") name.
    const organizationId = params.organizationId ?? (await this.resolveOrganizationId());
    const name = detected ?? `Unidentified Athlete ${new Date().toISOString().slice(0, 10)}`;

    const created = await db.athlete.create({
      data: {
        name,
        gender: 'Unknown',
        nationality: 'Unknown',
        sport: 'Unknown',
        dateOfBirth: new Date('1990-01-01'),
        status: 'ACTIVE',
        organizationId,
      },
    });
    logger.info(`➕ Created new athlete "${name}" (${created.id}) from upload`);
    return { athleteId: created.id, athleteName: created.name, matched: false, detectedName: detected };
  }

  // ── Detection ────────────────────────────────────────────────────────────────

  private static detectFromText(rawText?: string): string | null {
    if (!rawText) return null;
    const labels = /(?:athlete|patient|subject|name)\s*[:#-]?\s*([A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){0,3})/;
    for (const line of rawText.split('\n').slice(0, 40)) {
      const m = line.match(labels);
      if (m && m[1]) {
        const cleaned = this.cleanName(m[1]);
        if (cleaned) return cleaned;
      }
    }
    return null;
  }

  private static detectFromFileName(fileName: string): string | null {
    const base = fileName.replace(/\.[^.]+$/, ''); // strip extension
    const tokens = base
      .replace(/[-_.]+/g, ' ')
      .replace(/\d+/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !this.NOISE.has(t.toLowerCase()));
    if (tokens.length === 0) return null;
    return this.cleanName(tokens.slice(0, 4).join(' '));
  }

  private static cleanName(raw: string): string | null {
    const name = raw
      .split(/\s+/)
      .filter((w) => w.length > 0 && !this.NOISE.has(w.toLowerCase()))
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();
    return name.length >= 2 ? name : null;
  }

  // ── Matching ─────────────────────────────────────────────────────────────────

  private static normalizeKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private static async findExisting(detected: string, organizationId?: string) {
    const key = this.normalizeKey(detected);
    const candidates = await db.athlete.findMany({
      where: { deletedAt: null, ...(organizationId ? { organizationId } : {}) },
    });

    // Exact normalised match first.
    let best = candidates.find((a) => this.normalizeKey(a.name) === key);
    if (best) return best;

    // Otherwise require strong token overlap (all detected tokens present).
    const detectedTokens = key.split(' ').filter(Boolean);
    if (detectedTokens.length >= 2) {
      best = candidates.find((a) => {
        const aTokens = new Set(this.normalizeKey(a.name).split(' ').filter(Boolean));
        return detectedTokens.every((t) => aTokens.has(t));
      });
    }
    return best ?? null;
  }

  private static async resolveOrganizationId(): Promise<string> {
    const org = await db.organization.findFirst();
    if (org) return org.id;
    const created = await db.organization.create({
      data: { name: 'Default Organization', slug: `org-${Date.now()}` },
    });
    return created.id;
  }
}
