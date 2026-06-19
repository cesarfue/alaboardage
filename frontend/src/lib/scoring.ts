import type { Skill } from '$lib/types';

function normalize(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
}

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
	for (const skill of skills) {
		const re = makePattern(skill.name);

		const inTitle = re.test(normTitle) ? 1 : 0;
		re.lastIndex = 0; // reset car le regex a le flag 'g'
		const inDesc = re.test(normDesc) ? 1 : 0;
		re.lastIndex = 0;

		if (skill.level === 'primary') {
			total += inTitle * 3 + inDesc * 1;
		} else {
			total += inTitle * 1.5 + inDesc * 0.5;
		}
	}

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
