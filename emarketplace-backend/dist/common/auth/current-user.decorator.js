"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
const domain_errors_1 = require("../errors/domain-errors");
exports.CurrentUser = (0, common_1.createParamDecorator)((field, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const principal = request.user;
    if (!principal) {
        throw new domain_errors_1.UnauthorizedError('Authenticated principal missing from request');
    }
    return field === undefined ? principal : principal[field];
});
//# sourceMappingURL=current-user.decorator.js.map