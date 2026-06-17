import { useState } from "react";
import { statKeys, statLabels, type StatKey, type TitanCardData } from "@/lib/techTitansDeck";

type TitanCardProps = {
  card?: TitanCardData;
  hidden?: boolean;
  selectedStat?: StatKey | null;
  compact?: boolean;
};

const rarityClass = {
  Founder: "rarity-founder",
  Disruptor: "rarity-disruptor",
  Innovator: "rarity-innovator",
  Legend: "rarity-legend",
  Titan: "rarity-titan",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TitanCard({ card, hidden = false, selectedStat, compact = false }: TitanCardProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);

  if (!card || hidden) {
    return (
      <article className={`titan-card card-back ${compact ? "compact-card" : ""}`}>
        <div className="flux-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="card-back-kicker">Project Flux</p>
          <h2>Hidden Titan</h2>
          <p>Choose a category to reveal this card.</p>
        </div>
      </article>
    );
  }

  return (
    <article className={`titan-card ${rarityClass[card.rarity]} ${compact ? "compact-card" : ""}`}>
      <div className="card-topline">
        <span>{card.rarity} Class</span>
        <strong>{card.organisation}</strong>
      </div>
      <div className="portrait">
        {!portraitFailed ? (
          <img
            alt={card.name}
            src={`/api/portrait/${card.id}`}
            onError={() => {
              setPortraitFailed(true);
            }}
          />
        ) : (
          <span>{initials(card.name)}</span>
        )}
        <div className="portrait-gloss" aria-hidden="true" />
      </div>
      <div className="card-heading">
        <h2>{card.name}</h2>
        <p>{card.shortBio}</p>
      </div>
      <div className="stats-grid">
        {statKeys.map((key) => (
          <div className={`stat-row ${selectedStat === key ? "selected-stat" : ""}`} key={key}>
            <span>{statLabels[key]}</span>
            <strong>{card.stats[key]}</strong>
          </div>
        ))}
      </div>
      <div className="ability">
        <span>Special Ability</span>
        <p>{card.specialAbility}</p>
      </div>
    </article>
  );
}
