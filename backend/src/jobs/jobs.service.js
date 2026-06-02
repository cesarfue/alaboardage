var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
import { Injectable, NotFoundException } from '@nestjs/common';
let JobsService = (() => {
    let _classDecorators = [Injectable()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var JobsService = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            JobsService = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        prisma;
        constructor(prisma) {
            this.prisma = prisma;
        }
        async findAll(query) {
            const where = {};
            if (query.source)
                where.source = query.source;
            if (query.company)
                where.company = { contains: query.company, mode: 'insensitive' };
            if (query.location)
                where.location = { contains: query.location, mode: 'insensitive' };
            if (query.q) {
                where.OR = [
                    { title: { contains: query.q, mode: 'insensitive' } },
                    { description: { contains: query.q, mode: 'insensitive' } },
                ];
            }
            const [items, total] = await Promise.all([
                this.prisma.job.findMany({
                    where,
                    orderBy: { datePosted: 'desc' },
                    take: query.limit,
                    skip: query.offset,
                }),
                this.prisma.job.count({ where }),
            ]);
            return { items, total, limit: query.limit, offset: query.offset };
        }
        async findOne(id) {
            const job = await this.prisma.job.findUnique({ where: { id } });
            if (!job)
                throw new NotFoundException(`Job ${id} not found`);
            return job;
        }
        upsert(dto) {
            const { source, externalId, ...data } = dto;
            return this.prisma.job.upsert({
                where: { source_externalId: { source, externalId } },
                create: { source, externalId, ...data },
                update: data,
            });
        }
        upsertMany(dtos) {
            return this.prisma.$transaction(dtos.map((dto) => this.upsertQuery(dto)));
        }
        async deleteAll() {
            const { count } = await this.prisma.job.deleteMany({});
            return count;
        }
        upsertQuery(dto) {
            const { source, externalId, ...data } = dto;
            return this.prisma.job.upsert({
                where: { source_externalId: { source, externalId } },
                create: { source, externalId, ...data },
                update: data,
            });
        }
    };
    return JobsService = _classThis;
})();
export { JobsService };
