import type { Skill } from '$lib/types';
import { normalizeText as normalize } from '$lib/utils';

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makePattern(skillName: string): RegExp {
	return new RegExp(`\\b${escapeRegex(normalize(skillName))}\\b`, 'gi');
}

export function scoreJob(
	job: { title: string; description: string },
	skills: Skill[]
): number {
	const normTitle = normalize(job.title);
	const normDesc = normalize(job.description);

	let total = 0;
	let hasTitleMatch = false;
	for (const skill of skills) {
		const re = makePattern(skill.name);
		const inTitle = re.test(normTitle);
		re.lastIndex = 0;
		const inDesc = re.test(normDesc);
		re.lastIndex = 0;

		if (!inTitle && !inDesc) continue;
		total += skill.level === 'primary' ? 1 : 0.5;
		if (inTitle) hasTitleMatch = true;
	}
	if (hasTitleMatch) total += 0.5;

	return total;
}

export function matchedSkills(
	job: { title: string; description: string },
	skills: Skill[]
): Skill[] {
	const normTitle = normalize(job.title);
	const normDesc = normalize(job.description);

	const primary: Skill[] = [];
	const secondary: Skill[] = [];

	for (const skill of skills) {
		const re = makePattern(skill.name);
		if (re.test(normTitle) || re.test(normDesc)) {
			if (skill.level === 'primary') {
				primary.push(skill);
			} else {
				secondary.push(skill);
			}
		}
	}

	return [...primary, ...secondary];
}
