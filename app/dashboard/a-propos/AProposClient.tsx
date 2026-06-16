"use client";

import MaisonStatus from "./MaisonStatus";
import NextCollections from "./NextCollections";
import IntroSection, { type Intro } from "./IntroSection";
import LinksSection, { type Link } from "./LinksSection";
import ContactsSection, { type Contact } from "./ContactsSection";

type Props = {
  initialIntro: Intro;
  initialLinks: Link[];
  initialContacts: Contact[];
  currentUserId: string;
  showCollections: boolean;
};

export default function AProposClient({
  initialIntro,
  initialLinks,
  initialContacts,
  currentUserId,
  showCollections,
}: Props) {
  return (
    <div className="space-y-5">
      <IntroSection
        initialIntro={initialIntro}
        currentUserId={currentUserId}
        showCollections={showCollections}
      />

      <MaisonStatus />

      {showCollections && <NextCollections />}

      <LinksSection
        initialLinks={initialLinks}
        currentUserId={currentUserId}
      />

      <ContactsSection
        initialContacts={initialContacts}
        currentUserId={currentUserId}
      />
    </div>
  );
}