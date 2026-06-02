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
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, } from 'class-validator';
import { JobSource } from '../../../generated/prisma/enums';
let ScrapeRequestDto = (() => {
    let _source_decorators;
    let _source_initializers = [];
    let _source_extraInitializers = [];
    let _query_decorators;
    let _query_initializers = [];
    let _query_extraInitializers = [];
    let _location_decorators;
    let _location_initializers = [];
    let _location_extraInitializers = [];
    let _limit_decorators;
    let _limit_initializers = [];
    let _limit_extraInitializers = [];
    let _offset_decorators;
    let _offset_initializers = [];
    let _offset_extraInitializers = [];
    let _singlePage_decorators;
    let _singlePage_initializers = [];
    let _singlePage_extraInitializers = [];
    return class ScrapeRequestDto {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _source_decorators = [IsEnum(JobSource)];
            _query_decorators = [IsString()];
            _location_decorators = [IsOptional(), IsString()];
            _limit_decorators = [IsOptional(), Type(() => Number), IsInt(), Min(1), Max(200)];
            _offset_decorators = [IsOptional(), Type(() => Number), IsInt(), Min(1)];
            _singlePage_decorators = [IsOptional(), Type(() => Boolean), IsBoolean()];
            __esDecorate(null, null, _source_decorators, { kind: "field", name: "source", static: false, private: false, access: { has: obj => "source" in obj, get: obj => obj.source, set: (obj, value) => { obj.source = value; } }, metadata: _metadata }, _source_initializers, _source_extraInitializers);
            __esDecorate(null, null, _query_decorators, { kind: "field", name: "query", static: false, private: false, access: { has: obj => "query" in obj, get: obj => obj.query, set: (obj, value) => { obj.query = value; } }, metadata: _metadata }, _query_initializers, _query_extraInitializers);
            __esDecorate(null, null, _location_decorators, { kind: "field", name: "location", static: false, private: false, access: { has: obj => "location" in obj, get: obj => obj.location, set: (obj, value) => { obj.location = value; } }, metadata: _metadata }, _location_initializers, _location_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: obj => "limit" in obj, get: obj => obj.limit, set: (obj, value) => { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            __esDecorate(null, null, _offset_decorators, { kind: "field", name: "offset", static: false, private: false, access: { has: obj => "offset" in obj, get: obj => obj.offset, set: (obj, value) => { obj.offset = value; } }, metadata: _metadata }, _offset_initializers, _offset_extraInitializers);
            __esDecorate(null, null, _singlePage_decorators, { kind: "field", name: "singlePage", static: false, private: false, access: { has: obj => "singlePage" in obj, get: obj => obj.singlePage, set: (obj, value) => { obj.singlePage = value; } }, metadata: _metadata }, _singlePage_initializers, _singlePage_extraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        source = __runInitializers(this, _source_initializers, void 0);
        query = (__runInitializers(this, _source_extraInitializers), __runInitializers(this, _query_initializers, void 0));
        location = (__runInitializers(this, _query_extraInitializers), __runInitializers(this, _location_initializers, ''));
        limit = (__runInitializers(this, _location_extraInitializers), __runInitializers(this, _limit_initializers, 20));
        offset = (__runInitializers(this, _limit_extraInitializers), __runInitializers(this, _offset_initializers, 1));
        singlePage = (__runInitializers(this, _offset_extraInitializers), __runInitializers(this, _singlePage_initializers, false));
        constructor() {
            __runInitializers(this, _singlePage_extraInitializers);
        }
    };
})();
export { ScrapeRequestDto };
