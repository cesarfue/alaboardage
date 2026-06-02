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
import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { BoardScraper } from './board.scraper';
import { HELLOWORK } from './boards/hellowork.config';
import { LINKEDIN } from './boards/linkedin.config';
import { WTTJ } from './boards/wttj.config';
import { JobSource } from '../../generated/prisma/enums';
let ScraperService = (() => {
    let _classDecorators = [Injectable()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ScraperService = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            ScraperService = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        jobsService;
        logger = new Logger(ScraperService.name);
        constructor(jobsService) {
            this.jobsService = jobsService;
        }
        async scrape(dto) {
            const config = this.configFor(dto.source);
            this.logger.log(`Scraping ${config.name} q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`);
            const browser = await chromium.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            try {
                const scraper = new BoardScraper(browser, config, dto, dto.source);
                const jobs = await scraper.search();
                this.logger.log(`Scraped ${jobs.length} jobs from ${config.name}`);
                if (jobs.length > 0)
                    await this.jobsService.upsertMany(jobs);
                return { source: dto.source, count: jobs.length };
            }
            finally {
                await browser.close();
            }
        }
        async refresh(dto) {
            const start = Date.now();
            const deleted = dto.hard ? await this.jobsService.deleteAll() : 0;
            this.logger.log(`Refresh (hard=${dto.hard}, deleted=${deleted}) q="${dto.query}" loc="${dto.location}" limit=${dto.limit}`);
            const sources = Object.values(JobSource);
            const counts = await Promise.all(sources.map(async (source) => {
                try {
                    const r = await this.scrape({
                        source,
                        query: dto.query,
                        location: dto.location,
                        limit: dto.limit,
                        offset: 1,
                        singlePage: true,
                    });
                    return r;
                }
                catch (e) {
                    this.logger.error(`Failed to scrape ${source}: ${e.message}`);
                    return { source, count: 0 };
                }
            }));
            const total = counts.reduce((acc, c) => acc + c.count, 0);
            return {
                deleted,
                counts,
                total,
                durationMs: Date.now() - start,
            };
        }
        configFor(source) {
            switch (source) {
                case JobSource.LINKEDIN:
                    return LINKEDIN;
                case JobSource.HELLOWORK:
                    return HELLOWORK;
                case JobSource.WTTJ:
                    return WTTJ;
            }
        }
    };
    return ScraperService = _classThis;
})();
export { ScraperService };
