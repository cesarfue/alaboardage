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
import { IsDate, IsEnum, IsNotEmpty, IsString, IsUrl, } from 'class-validator';
import { JobSource } from '../../../generated/prisma/enums';
let CreateJobDto = (() => {
    let _externalId_decorators;
    let _externalId_initializers = [];
    let _externalId_extraInitializers = [];
    let _source_decorators;
    let _source_initializers = [];
    let _source_extraInitializers = [];
    let _title_decorators;
    let _title_initializers = [];
    let _title_extraInitializers = [];
    let _company_decorators;
    let _company_initializers = [];
    let _company_extraInitializers = [];
    let _location_decorators;
    let _location_initializers = [];
    let _location_extraInitializers = [];
    let _description_decorators;
    let _description_initializers = [];
    let _description_extraInitializers = [];
    let _url_decorators;
    let _url_initializers = [];
    let _url_extraInitializers = [];
    let _datePosted_decorators;
    let _datePosted_initializers = [];
    let _datePosted_extraInitializers = [];
    return class CreateJobDto {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _externalId_decorators = [IsString(), IsNotEmpty()];
            _source_decorators = [IsEnum(JobSource)];
            _title_decorators = [IsString(), IsNotEmpty()];
            _company_decorators = [IsString()];
            _location_decorators = [IsString()];
            _description_decorators = [IsString()];
            _url_decorators = [IsUrl()];
            _datePosted_decorators = [Type(() => Date), IsDate()];
            __esDecorate(null, null, _externalId_decorators, { kind: "field", name: "externalId", static: false, private: false, access: { has: obj => "externalId" in obj, get: obj => obj.externalId, set: (obj, value) => { obj.externalId = value; } }, metadata: _metadata }, _externalId_initializers, _externalId_extraInitializers);
            __esDecorate(null, null, _source_decorators, { kind: "field", name: "source", static: false, private: false, access: { has: obj => "source" in obj, get: obj => obj.source, set: (obj, value) => { obj.source = value; } }, metadata: _metadata }, _source_initializers, _source_extraInitializers);
            __esDecorate(null, null, _title_decorators, { kind: "field", name: "title", static: false, private: false, access: { has: obj => "title" in obj, get: obj => obj.title, set: (obj, value) => { obj.title = value; } }, metadata: _metadata }, _title_initializers, _title_extraInitializers);
            __esDecorate(null, null, _company_decorators, { kind: "field", name: "company", static: false, private: false, access: { has: obj => "company" in obj, get: obj => obj.company, set: (obj, value) => { obj.company = value; } }, metadata: _metadata }, _company_initializers, _company_extraInitializers);
            __esDecorate(null, null, _location_decorators, { kind: "field", name: "location", static: false, private: false, access: { has: obj => "location" in obj, get: obj => obj.location, set: (obj, value) => { obj.location = value; } }, metadata: _metadata }, _location_initializers, _location_extraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: obj => "description" in obj, get: obj => obj.description, set: (obj, value) => { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            __esDecorate(null, null, _url_decorators, { kind: "field", name: "url", static: false, private: false, access: { has: obj => "url" in obj, get: obj => obj.url, set: (obj, value) => { obj.url = value; } }, metadata: _metadata }, _url_initializers, _url_extraInitializers);
            __esDecorate(null, null, _datePosted_decorators, { kind: "field", name: "datePosted", static: false, private: false, access: { has: obj => "datePosted" in obj, get: obj => obj.datePosted, set: (obj, value) => { obj.datePosted = value; } }, metadata: _metadata }, _datePosted_initializers, _datePosted_extraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        externalId = __runInitializers(this, _externalId_initializers, void 0);
        source = (__runInitializers(this, _externalId_extraInitializers), __runInitializers(this, _source_initializers, void 0));
        title = (__runInitializers(this, _source_extraInitializers), __runInitializers(this, _title_initializers, void 0));
        company = (__runInitializers(this, _title_extraInitializers), __runInitializers(this, _company_initializers, void 0));
        location = (__runInitializers(this, _company_extraInitializers), __runInitializers(this, _location_initializers, void 0));
        description = (__runInitializers(this, _location_extraInitializers), __runInitializers(this, _description_initializers, void 0));
        url = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _url_initializers, void 0));
        datePosted = (__runInitializers(this, _url_extraInitializers), __runInitializers(this, _datePosted_initializers, void 0));
        constructor() {
            __runInitializers(this, _datePosted_extraInitializers);
        }
    };
})();
export { CreateJobDto };
