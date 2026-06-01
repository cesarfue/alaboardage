import { Link } from "react-router-dom";
import type { Job } from "../lib/types";

interface Props {
  job: Job;
}

export function JobCard({ job }: Props) {
  const postedAt = new Date(job.datePosted).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 8,
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        background: "#fff",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem", lineHeight: 1.3 }}>
          <Link
            to={`/jobs/${job.id}`}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            {job.title}
          </Link>
        </h2>
        <span
          style={{
            fontSize: "0.75rem",
            padding: "0.15rem 0.5rem",
            borderRadius: 4,
            background: "#f0f0f0",
            whiteSpace: "nowrap",
            alignSelf: "flex-start",
          }}
        >
          {job.source}
        </span>
      </header>

      <div style={{ color: "#555", fontSize: "0.9rem" }}>
        <strong>{job.company}</strong> · {job.location}
      </div>
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.8rem",
          color: "#777",
          marginTop: "0.25rem",
        }}
      >
        <time dateTime={job.datePosted}>{postedAt}</time>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "0.85rem" }}
        >
          Voir l'offre →
        </a>
      </footer>
    </article>
  );
}
