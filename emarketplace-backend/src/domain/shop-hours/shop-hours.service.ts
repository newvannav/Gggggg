import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShopOperatingHours } from '../../generated/prisma';

/**
 * Operating-hours evaluation.
 *
 * ShopOperatingHours stores dayOfWeek (0=Sunday..6=Saturday) plus opensAt/closesAt
 * as @db.Time. We interpret "today" in the SHOP's IANA timezone via Intl — no
 * external dependency required, deterministic enough for open/close decisions.
 */
export interface OpennessResult {
  readonly isOpen: boolean;
  /** ISO timestamp of next opening moment (only when closed). */
  readonly opensAtIso?: string;
}

@Injectable()
export class ShopHoursService {
  private readonly logger = new Logger(ShopHoursService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Load hours for a set of shop ids in one query, grouped by shopId. */
  async hoursByShopIds(shopIds: readonly number[]): Promise<Map<number, ShopOperatingHours[]>> {
    if (shopIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.shopOperatingHours.findMany({
      where: { shopId: { in: [...shopIds] } },
    });
    const grouped = new Map<number, ShopOperatingHours[]>();
    for (const row of rows) {
      const list = grouped.get(row.shopId);
      if (list) {
        list.push(row);
      } else {
        grouped.set(row.shopId, [row]);
      }
    }
    return grouped;
  }

  isOpenNow(timezone: string, hours: readonly ShopOperatingHours[], now = new Date()): OpennessResult {
    const { dayOfWeek, minutesOfDay } = this.zonedParts(now, timezone);

    const today = hours.find((h) => h.dayOfWeek === dayOfWeek);

    if (!today || today.isClosed) {
      const next = this.nextOpenIso(hours, dayOfWeek, timezone, now);
      return next !== undefined ? { isOpen: false, opensAtIso: next } : { isOpen: false };
    }

    const openMin = this.timeToMinutes(today.opensAt);
    const closeMin = this.timeToMinutes(today.closesAt);

    // Handles normal (09:00-22:00) and overnight (22:00-02:00) windows.
    const withinWindow =
      closeMin >= openMin
        ? minutesOfDay >= openMin && minutesOfDay < closeMin
        : minutesOfDay >= openMin || minutesOfDay < closeMin;

    if (withinWindow) {
      return { isOpen: true };
    }

    const next = this.nextOpenIso(hours, dayOfWeek, timezone, now);
    return next !== undefined ? { isOpen: false, opensAtIso: next } : { isOpen: false };
  }

  /** Minutes-of-day extraction honoring the shop timezone (UTC fallback on bad tz). */
  private zonedParts(instant: Date, timezone: string): { dayOfWeek: number; minutesOfDay: number } {
    let tz = timezone;
    try {
      // Validate IANA name; fall back to UTC so a bad vendor edit can never 500 discovery.
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      this.logger.warn(`Invalid timezone "${timezone}" — falling back to UTC`);
      tz = 'UTC';
    }

    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = fmt.formatToParts(instant);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

    const dayIndex: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    return { dayOfWeek: dayIndex[weekday] ?? 0, minutesOfDay: hour * 60 + minute };
  }

  /** Best-effort "next opening" up to 7 days ahead. */
  private nextOpenIso(
    hours: readonly ShopOperatingHours[],
    currentDay: number,
    timezone: string,
    now: Date,
  ): string | undefined {
    for (let offset = 0; offset <= 7; offset += 1) {
      const day = (currentDay + offset) % 7;
      const entry = hours.find((h) => h.dayOfWeek === day && !h.isClosed);
      if (!entry) {
        continue;
      }
      const candidate = this.buildZonedInstant(now, timezone, offset, this.timeToMinutes(entry.opensAt));
      if (candidate.getTime() > now.getTime()) {
        return candidate.toISOString();
      }
    }
    return undefined;
  }

  /** Convert a HH:MM stored in @db.Time (Date with epoch date) to minutes since midnight. */
  private timeToMinutes(t: Date): number {
    // Prisma maps pg `time` to a Date anchored at 1970-01-01T00:00:00Z.
    return t.getUTCHours() * 60 + t.getUTCMinutes();
  }

  /** Build a real instant: `offset` days after today (in tz), at given tz-local minute. */
  private buildZonedInstant(now: Date, timezone: string, offsetDays: number, minutes: number): Date {
    const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); // YYYY-MM-DD
    const baseDateStr = dayFmt.format(new Date(now.getTime() + offsetDays * 86_400_000));
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    // Interpret wall-clock time in tz: build the instant as if UTC then shift by
    // the zone offset observed at that guess (accurate ±1min; DST edges are fine
    // for open/close UX messaging).
    const guessUtc = new Date(`${baseDateStr}T${pad(hour)}:${pad(minute)}:00Z`);
    const offsetMs = tzOffsetMs(guessUtc, timezone);
    return new Date(guessUtc.getTime() - offsetMs);
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Milliseconds that `timezone` is ahead of UTC at the given instant. */
function tzOffsetMs(instant: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const map: Record<string, number> = {};
  for (const { type, value } of dtf.formatToParts(instant)) {
    map[type] = Number(value);
  }
  const wallClockAsUtc = Date.UTC(
    map['year'] ?? 1970,
    (map['month'] ?? 1) - 1,
    map['day'] ?? 1,
    (map['hour'] ?? 0) % 24,
    map['minute'] ?? 0,
    map['second'] ?? 0,
  );
  const truncatedInstant = Math.floor(instant.getTime() / 1000) * 1000;
  return wallClockAsUtc - truncatedInstant;
}
