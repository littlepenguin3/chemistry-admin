import type { CSSProperties } from "react";
import { BookOpenCheck, ChevronRight, FlaskConical, Layers3, Sparkles, Video } from "lucide-react";
import type { StudentLearningElementBadge, StudentLearningProfile, StudentLearningPropertyCard, StudentLearningPropertySection } from "../../api";
import { MobileButton } from "../../mobile/primitives";
import { LearningAtomModelCard } from "../atom-viewer/LearningAtomModelCard";
import { LearningElementChips } from "./LearningElementChips";

export function LearningFactsView({
  profile,
  elements,
  selectedElement,
  selectedSection,
  experimentCount,
  onSelectElement,
  onShowExperiments,
}: {
  profile: StudentLearningProfile;
  elements: StudentLearningElementBadge[];
  selectedElement: StudentLearningElementBadge | null;
  selectedSection: StudentLearningPropertySection | null;
  experimentCount: number;
  onSelectElement: (symbol: string) => void;
  onShowExperiments: () => void;
}) {
  return (
    <div className="chapter-view-panel facts-view" data-view="facts">
      <LearningElementChips elements={elements} activeSymbol={selectedElement?.symbol || ""} onSelectElement={onSelectElement} />
      {selectedElement ? <LearningAtomModelCard element={selectedElement} profile={profile} /> : null}
      <LearningReferenceMedia profile={profile} selectedElement={selectedElement} />
      <LearningFamilyCommonProperties profile={profile} />
      <LearningPropertySectionSummaries profile={profile} selectedSection={selectedSection} />
      <section className="facts-to-experiments-card">
        <div>
          <p>下一步</p>
          <h2>进入实验-点位视频学习</h2>
          <span>本章节已整理 {experimentCount} 个开放实验点位，按实验和点位顺序学习。</span>
        </div>
        <MobileButton className="facts-to-experiments-action" type="button" variant="secondary" fullWidth={false} onClick={onShowExperiments}>
          <Video size={18} />
          <span>看实验视频</span>
        </MobileButton>
      </section>
    </div>
  );
}

function LearningPropertySectionSummaries({
  profile,
  selectedSection,
}: {
  profile: StudentLearningProfile;
  selectedSection: StudentLearningPropertySection | null;
}) {
  if (!profile.property_sections.length) return null;
  return (
    <section className="property-section-panel facts-property-panel">
      <div className="selection-head">
        <span style={{ "--area-color": "#087246" } as CSSProperties}>
          <Layers3 size={18} />
        </span>
        <div>
          <p>族元素的典型性质</p>
          <h2>{selectedSection?.title || "通性与趋势"}</h2>
        </div>
      </div>
      <div className="property-section-list">
        {profile.property_sections.map((section) => (
          <article className={selectedSection?.key === section.key ? "property-section-summary active" : "property-section-summary"} key={section.key}>
            <strong>{section.title}</strong>
            <span>{section.subtitle || section.summary}</span>
            {section.formula ? <small>{section.formula}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function LearningReferenceMedia({
  profile,
  selectedElement,
}: {
  profile: StudentLearningProfile;
  selectedElement: StudentLearningElementBadge | null;
}) {
  const referenceMedia = Array.isArray(profile.reference_media) ? profile.reference_media : [];
  const media = referenceMedia.filter((item) => {
    const itemElementSymbols = item.element_symbols || [];
    if (!selectedElement || !itemElementSymbols.length) return true;
    return itemElementSymbols.includes(selectedElement.symbol);
  });
  if (!media.length) return null;

  return (
    <section className="reference-media-panel" aria-label="公开参考素材">
      <div className="selection-head">
        <span style={{ "--area-color": "#0f7b4d" } as CSSProperties}>
          <Sparkles size={18} />
        </span>
        <div>
          <p>公开参考素材</p>
          <h2>补充观察</h2>
        </div>
      </div>
      <div className="reference-media-list">
        {media.slice(0, 2).map((item) => (
          <a className="reference-media-item" href={item.source_url} key={item.id} target="_blank" rel="noreferrer">
            {item.local_path && item.asset_type === "image" ? <img src={item.local_path} alt={item.alt_text} /> : <BookOpenCheck size={22} />}
            <span>
              <strong>{item.alt_text}</strong>
              <small>{item.license} · {item.attribution}</small>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function LearningFamilyCommonProperties({ profile }: { profile: StudentLearningProfile }) {
  const cards = profile.family_common_properties?.length ? profile.family_common_properties : profile.property_cards;
  return (
    <section className="family-common-panel" aria-label="全族通性">
      <div className="selection-head">
        <span style={{ "--area-color": "#0f7b4d" } as CSSProperties}>
          <BookOpenCheck size={18} />
        </span>
        <div>
          <p>{profile.family_name || profile.title}</p>
          <h2>全族通性</h2>
        </div>
      </div>
      <LearningPropertyCards cards={cards} label="全族通性卡片" />
    </section>
  );
}

function LearningPropertyCards({ cards, label }: { cards: StudentLearningPropertyCard[]; label: string }) {
  return (
    <section className="property-card-grid" aria-label={label}>
      {cards.map((card) => (
        <article className="property-card" key={card.key}>
          <p>{card.label}</p>
          <strong>{card.value}</strong>
          {card.description ? <span>{card.description}</span> : null}
        </article>
      ))}
    </section>
  );
}

function PropertySectionButton({
  section,
  active,
  onClick,
}: {
  section: StudentLearningPropertySection;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={active ? "property-section active" : "property-section"} type="button" aria-pressed={active} onClick={onClick}>
      <div>
        <strong>{section.title}</strong>
        <span>{section.subtitle || section.summary}</span>
      </div>
      <ChevronRight size={17} />
    </button>
  );
}
