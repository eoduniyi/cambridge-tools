/**
 * Legal constraints for flyering in Cambridge, MA.
 * Source: Cambridge Municipal Code, Chapter 12.16 (Signs & Posting)
 */

export interface LegalRule {
  id: string;
  category: "prohibited" | "permitted" | "conditional";
  title: string;
  description: string;
  penalty?: string;
}

export const LEGAL_RULES: LegalRule[] = [
  {
    id: "no-public-infra",
    category: "prohibited",
    title: "Public Infrastructure",
    description:
      "Do not affix flyers to utility poles, light posts, traffic signs, city trees, or hydrants.",
    penalty: "Up to $300 per violation",
  },
  {
    id: "private-permission",
    category: "conditional",
    title: "Private Property",
    description:
      "Always obtain explicit permission from the business manager or owner before posting.",
  },
  {
    id: "library-protocol",
    category: "conditional",
    title: "Library Boards",
    description:
      "Flyers must be submitted to library staff for approval and hanging. Do not pin them yourself.",
  },
  {
    id: "university-property",
    category: "prohibited",
    title: "University Property",
    description:
      "Harvard and MIT have private policies. Generally only university-affiliated groups can post on their kiosks.",
  },
  {
    id: "public-boards",
    category: "permitted",
    title: "Designated Public Boards",
    description:
      "Some public spaces maintain community bulletin boards. These are fair game but check for size/content restrictions.",
  },
];
