"use client";

import SidepanelFamilyLegend from "./SidepanelFamilyLegend";
import SidepanelYearNav from "./SidepanelYearNav";
import SidepanelNewBookingButton from "./SidepanelNewBookingButton";
import SidepanelContextBanner from "./SidepanelContextBanner";
import SidepanelMyStays from "./SidepanelMyStays";

import type { BannerContext, UpcomingBooking } from "@/lib/dashboard-banner";
import type { FamilyName } from "@/lib/families";


type Props = {
  filterFamily: FamilyName | null;
  onToggleFamily: (name: FamilyName) => void;
  year: number;
  currentYear: number;
  onYearChange: (year: number) => void;
  onNewBooking: () => void;
  bannerContext: BannerContext;
  myStays: UpcomingBooking[];
};

/**
 * Sidepanel desktop (#31) : somme de blocks indépendants, du haut
 * vers le bas dans l'ordre de la spec. La V2 ajoutera de nouveaux
 * blocks (nav, stats…) sans toucher aux existants ni à la grille.
 */
export default function Sidepanel({
  filterFamily,
  onToggleFamily,
  year,
  currentYear,
  onYearChange,
  onNewBooking,
  bannerContext,
  myStays,
}: Props) {
  return (
    <aside className="w-56 shrink-0 sticky top-4 space-y-3">
      <SidepanelFamilyLegend
        filterFamily={filterFamily}
        onToggleFamily={onToggleFamily}
      />

      <SidepanelYearNav
        year={year}
        currentYear={currentYear}
        onYearChange={onYearChange}
      />

      <SidepanelNewBookingButton onClick={onNewBooking} />

      <SidepanelContextBanner
        context={bannerContext}
        onNewBooking={onNewBooking}
      />

      <SidepanelMyStays stays={myStays} />
    </aside>
  );
}
