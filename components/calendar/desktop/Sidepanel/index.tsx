"use client";

import SidepanelYearNav from "./SidepanelYearNav";
import SidepanelFamilyLegend from "./SidepanelFamilyLegend";
import SidepanelViewSwitcher from "./SidepanelViewSwitcher";
import SidepanelContextBanner from "./SidepanelContextBanner";
import SidepanelMyStays from "./SidepanelMyStays";

import type { BannerContext, UpcomingBooking } from "@/lib/dashboard-banner";
import type { FamilyName } from "@/lib/families";
import type { CalendarView } from "../../calendar-utils";


type Props = {
  filterFamily: FamilyName | null;
  onToggleFamily: (name: FamilyName) => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  year: number;
  currentYear: number;
  onYearChange: (year: number) => void;
  onNewBooking: () => void;
  bannerContext: BannerContext;
  myStays: UpcomingBooking[];
};

/**
 * Sidepanel desktop (#31) : somme de blocks indépendants.
 * Ordre : année → filtre familles → vue → bandeau contextuel →
 * mes prochains séjours. Le bouton "nouvelle demande" a été retiré
 * (on crée une demande en cliquant directement dans le calendrier) ;
 * le bandeau garde une invite contextuelle quand on n'a rien de prévu.
 */
export default function Sidepanel({
  filterFamily,
  onToggleFamily,
  view,
  onViewChange,
  year,
  currentYear,
  onYearChange,
  onNewBooking,
  bannerContext,
  myStays,
}: Props) {
  return (
    <aside className="w-56 shrink-0 sticky top-4 space-y-3">
      <SidepanelYearNav
        year={year}
        currentYear={currentYear}
        onYearChange={onYearChange}
      />

      <SidepanelFamilyLegend
        filterFamily={filterFamily}
        onToggleFamily={onToggleFamily}
      />

      <SidepanelViewSwitcher view={view} onViewChange={onViewChange} />

      <SidepanelContextBanner
        context={bannerContext}
        onNewBooking={onNewBooking}
      />

      <SidepanelMyStays stays={myStays} />
    </aside>
  );
}
