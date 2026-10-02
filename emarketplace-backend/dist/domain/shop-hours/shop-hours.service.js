"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ShopHoursService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopHoursService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let ShopHoursService = ShopHoursService_1 = class ShopHoursService {
    prisma;
    logger = new common_1.Logger(ShopHoursService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async hoursByShopIds(shopIds) {
        if (shopIds.length === 0) {
            return new Map();
        }
        const rows = await this.prisma.shopOperatingHours.findMany({
            where: { shopId: { in: [...shopIds] } },
        });
        const grouped = new Map();
        for (const row of rows) {
            const list = grouped.get(row.shopId);
            if (list) {
                list.push(row);
            }
            else {
                grouped.set(row.shopId, [row]);
            }
        }
        return grouped;
    }
    isOpenNow(timezone, hours, now = new Date()) {
        const { dayOfWeek, minutesOfDay } = this.zonedParts(now, timezone);
        const today = hours.find((h) => h.dayOfWeek === dayOfWeek);
        if (!today || today.isClosed) {
            const next = this.nextOpenIso(hours, dayOfWeek, timezone, now);
            return next !== undefined ? { isOpen: false, opensAtIso: next } : { isOpen: false };
        }
        const openMin = this.timeToMinutes(today.opensAt);
        const closeMin = this.timeToMinutes(today.closesAt);
        const withinWindow = closeMin >= openMin
            ? minutesOfDay >= openMin && minutesOfDay < closeMin
            : minutesOfDay >= openMin || minutesOfDay < closeMin;
        if (withinWindow) {
            return { isOpen: true };
        }
        const next = this.nextOpenIso(hours, dayOfWeek, timezone, now);
        return next !== undefined ? { isOpen: false, opensAtIso: next } : { isOpen: false };
    }
    zonedParts(instant, timezone) {
        let tz = timezone;
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: tz });
        }
        catch {
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
        const dayIndex = {
            Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
        };
        return { dayOfWeek: dayIndex[weekday] ?? 0, minutesOfDay: hour * 60 + minute };
    }
    nextOpenIso(hours, currentDay, timezone, now) {
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
    timeToMinutes(t) {
        return t.getUTCHours() * 60 + t.getUTCMinutes();
    }
    buildZonedInstant(now, timezone, offsetDays, minutes) {
        const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
        const baseDateStr = dayFmt.format(new Date(now.getTime() + offsetDays * 86_400_000));
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const guessUtc = new Date(`${baseDateStr}T${pad(hour)}:${pad(minute)}:00Z`);
        const offsetMs = tzOffsetMs(guessUtc, timezone);
        return new Date(guessUtc.getTime() - offsetMs);
    }
};
exports.ShopHoursService = ShopHoursService;
exports.ShopHoursService = ShopHoursService = ShopHoursService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ShopHoursService);
function pad(n) {
    return String(n).padStart(2, '0');
}
function tzOffsetMs(instant, timezone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const map = {};
    for (const { type, value } of dtf.formatToParts(instant)) {
        map[type] = Number(value);
    }
    const wallClockAsUtc = Date.UTC(map['year'] ?? 1970, (map['month'] ?? 1) - 1, map['day'] ?? 1, (map['hour'] ?? 0) % 24, map['minute'] ?? 0, map['second'] ?? 0);
    const truncatedInstant = Math.floor(instant.getTime() / 1000) * 1000;
    return wallClockAsUtc - truncatedInstant;
}
//# sourceMappingURL=shop-hours.service.js.map