"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get((config_1.ConfigService));
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
    }));
    app.enableCors({ origin: config.get('corsOrigin'), credentials: true });
    app.enableShutdownHooks();
    const port = config.get('port');
    await app.listen(port);
    common_1.Logger.log(`e-marketplace API listening on :${port} (prefix /v1)`);
}
void bootstrap();
//# sourceMappingURL=main.js.map