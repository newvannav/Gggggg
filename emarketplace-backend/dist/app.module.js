"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const core_1 = require("@nestjs/core");
const common_2 = require("@nestjs/common");
const app_config_1 = require("./config/app.config");
const prisma_module_1 = require("./common/prisma/prisma.module");
const pricing_module_1 = require("./domain/pricing.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const geolocation_module_1 = require("./modules/geolocation/geolocation.module");
const orders_module_1 = require("./modules/orders/orders.module");
const tracking_module_1 = require("./modules/tracking/tracking.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [app_config_1.loadAppConfig],
            }),
            jwt_1.JwtModule.registerAsync({
                global: true,
                useFactory: () => ({ secret: process.env.JWT_SECRET }),
            }),
            prisma_module_1.PrismaModule,
            pricing_module_1.PricingModule,
            geolocation_module_1.GeolocationModule,
            orders_module_1.OrdersModule,
            tracking_module_1.TrackingModule,
        ],
        providers: [
            { provide: core_1.APP_FILTER, useClass: all_exceptions_filter_1.AllExceptionsFilter },
            { provide: core_1.APP_INTERCEPTOR, useClass: common_2.ClassSerializerInterceptor },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map