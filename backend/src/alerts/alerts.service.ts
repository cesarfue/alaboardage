import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { SkillsService } from '../skills/skills.service';
import type { Job, SavedSearch, Skill } from '../../generated/prisma/client';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly skills: SkillsService,
  ) {}

  @Cron(process.env.ALERT_CRON ?? '0 8 * * *')
  async runAlerts(): Promise<void> {
    this.logger.log('Running daily alerts cron');

    const allSearches = await this.prisma.savedSearch.findMany();
    if (allSearches.length === 0) return;

    const searchesByUser = new Map<string, SavedSearch[]>();
    for (const s of allSearches) {
      const existing = searchesByUser.get(s.userId) ?? [];
      existing.push(s);
      searchesByUser.set(s.userId, existing);
    }

    const now = new Date();
    const fallbackSince = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25h ago

    for (const [userId, searches] of searchesByUser) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) continue;

      const userSkills: Skill[] = await this.skills.getSkills(userId);
      if (userSkills.length === 0) {
        this.logger.debug(`Skipping userId=${userId}: no skills`);
        continue;
      }

      const earliestSince = searches.reduce<Date>((min, s) => {
        const since = s.lastAlertAt ?? fallbackSince;
        return since < min ? since : min;
      }, now);

      const recentJobs: Job[] = await this.prisma.job.findMany({
        where: { scrapedAt: { gt: earliestSince } },
      });

      if (recentJobs.length === 0) continue;

      const sections: {
        search: SavedSearch;
        jobs: Array<{ job: Job; score: number }>;
      }[] = [];

      for (const search of searches) {
        const since = search.lastAlertAt ?? fallbackSince;
        const candidateJobs = recentJobs.filter((j) => j.scrapedAt > since);

        const scored = candidateJobs
          .map((job) => ({
            job,
            score: this.scoring.scoreJob(job, userSkills),
          }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        if (scored.length > 0) {
          sections.push({ search, jobs: scored });
        }
      }

      if (sections.length === 0) {
        this.logger.debug(`No matching jobs for userId=${userId}`);
        continue;
      }

      const totalCount = sections.reduce((sum, s) => sum + s.jobs.length, 0);
      const subject =
        sections.length === 1
          ? `[alaboardage] ${sections[0].jobs.length} nouvelle${sections[0].jobs.length > 1 ? 's' : ''} offre${sections[0].jobs.length > 1 ? 's' : ''} pour "${sections[0].search.name}"`
          : `[alaboardage] ${totalCount} nouvelles offres (${sections.length} recherches)`;

      const html = this.buildEmailHtml(sections);

      if (process.env.SMTP_HOST) {
        await this.sendEmail(user.email, subject, html);
      } else {
        this.logger.log(`[DRY RUN] Would send to ${user.email}: ${subject}`);
        for (const section of sections) {
          this.logger.log(
            `  Recherche "${section.search.name}" — ${section.jobs.length} job(s):`,
          );
          for (const { job, score } of section.jobs) {
            this.logger.log(
              `    [score=${score}] ${job.title} @ ${job.company} — ${job.url}`,
            );
          }
        }
      }

      const updatedSearchIds = sections.map((s) => s.search.id);
      await this.prisma.savedSearch.updateMany({
        where: { id: { in: updatedSearchIds } },
        data: { lastAlertAt: now },
      });
    }
  }

  private buildEmailHtml(
    sections: {
      search: SavedSearch;
      jobs: Array<{ job: Job; score: number }>;
    }[],
  ): string {
    const sectionsHtml = sections
      .map(
        ({ search, jobs }) => `
        <h2 style="color:#333;border-bottom:1px solid #ddd;padding-bottom:8px;">${search.name}</h2>
        <p style="color:#666;">${jobs.length} nouvelle${jobs.length > 1 ? 's' : ''} offre${jobs.length > 1 ? 's' : ''} correspondant à vos compétences</p>
        <ul style="list-style:none;padding:0;">
          ${jobs
            .map(
              ({ job, score }) => `
            <li style="padding:12px 0;border-bottom:1px solid #eee;">
              <a href="${job.url}" style="font-size:16px;font-weight:bold;color:#1a73e8;text-decoration:none;">${job.title}</a>
              <br/>
              <span style="color:#555;">${job.company}</span>
              <span style="color:#888;font-size:12px;margin-left:8px;">Score: ${score.toFixed(1)}</span>
            </li>`,
            )
            .join('')}
        </ul>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h1 style="color:#1a73e8;">alaboardage — Nouvelles offres</h1>
  ${sectionsHtml}
  <p style="color:#999;font-size:12px;margin-top:24px;">Vous recevez cet email car vous avez des recherches sauvegardées sur alaboardage.</p>
</body>
</html>`;
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });

    await transporter.sendMail({
      from: process.env.ALERT_FROM_EMAIL ?? 'alerts@alaboardage.local',
      to,
      subject,
      html,
    });

    this.logger.log(`Alert email sent to ${to}: ${subject}`);
  }
}
