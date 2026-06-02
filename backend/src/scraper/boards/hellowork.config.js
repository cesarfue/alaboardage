import { helloworkDate } from '../transforms';
export const HELLOWORK = {
    name: 'Hellowork',
    baseUrl: 'https://www.hellowork.com/fr-fr',
    boardPath: '/emploi/recherche.html',
    jobPath: '/emplois/{id}.html',
    selectors: {
        card: {
            selects: "li[data-id-storage-target='item']",
            returns: { kind: 'html' },
        },
        id: {
            selects: "li[data-id-storage-target='item']",
            returns: { kind: 'attribute', name: 'data-id-storage-item-id' },
        },
        title: {
            selects: 'h3.inline p:first-of-type',
            returns: { kind: 'text' },
        },
        company: {
            selects: 'h3.inline p:last-of-type',
            returns: { kind: 'text' },
        },
        location: {
            selects: "div[data-cy='localisationCard']",
            returns: { kind: 'text' },
        },
        description: {
            selects: 'div#offer-panel p',
            n: [0, 3],
            returns: { kind: 'text' },
        },
        datePosted: {
            selects: "div[class='tw-typo-s tw-text-grey-500 tw-pl-1 tw-pt-1']",
            returns: { kind: 'text' },
            transforms: helloworkDate,
        },
    },
    urlParams: {
        query: 'k',
        location: 'l',
        offset: 'p',
    },
    boardPageAction: async (page) => {
        const btn = page.locator('button#hw-cc-notice-accept-btn');
        try {
            await btn.click({ timeout: 5000 });
        }
        catch {
            // cookie banner already dismissed or absent
        }
    },
};
