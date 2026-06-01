import type { BoardConfig } from '../types';

export const WTTJ: BoardConfig = {
  name: 'WelcomeToTheJungle',
  baseUrl: 'https://www.welcometothejungle.com',
  boardPath: '/fr/jobs?',
  jobPath: '{id}',
  selectors: {
    card: {
      selects: "li[data-testid='search-results-list-item-wrapper']",
      returns: { kind: 'html' },
    },
    id: {
      selects: 'a',
      returns: { kind: 'attribute', name: 'href' },
    },
    title: {
      selects: "div[role='mark']",
      returns: { kind: 'text' },
    },
    company: {
      selects: 'span.wui-text',
      returns: { kind: 'text' },
    },
    location: {
      selects: "i[name='location'] + span > span",
      returns: { kind: 'text' },
    },
    description: {
      selects: 'div#the-position-section',
      returns: { kind: 'text' },
    },
    datePosted: {
      selects: 'time',
      returns: { kind: 'attribute', name: 'datetime' },
    },
  },
  urlParams: {
    query: 'query',
    location: 'aroundQuery',
    offset: 'page',
  },
  boardPageAction: async (page) => {
    // Dismiss cookie banner
    try {
      await page.locator('button#axeptio_btn_dismiss').click({ timeout: 5000 });
    } catch {
      // already dismissed or absent
    }

    // Focus the location field and trigger autocomplete (mirrors Rust click_point + space)
    try {
      await page.mouse.click(600, 190);
      await page.keyboard.press(' ');
      await page
        .locator("div[data-testid='place-item-0'] div")
        .click({ timeout: 5000 });
      await page.waitForTimeout(2000);
    } catch {
      // location autocomplete unavailable, continue with raw query string
    }
  },
};
