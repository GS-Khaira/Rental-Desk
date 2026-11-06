export const AREAS = [
  "Charlottetown – Downtown",
  "Charlottetown – Brighton",
  "Charlottetown – Sherwood",
  "Charlottetown – Parkdale",
  "Charlottetown – West Royalty",
  "Charlottetown – East Royalty",
  "Charlottetown – Hillsborough Park",
  "Charlottetown – Other",
  "Stratford",
  "Cornwall",
  "Summerside",
  "Kensington",
  "Montague",
  "Souris",
  "North Rustico",
  "West Prince (Alberton/O'Leary/Tignish)",
  "Borden-Carleton",
  "Other (rural)",
];
export const shortArea = (a: string) => a.replace("Charlottetown – ", "Ch'town ");

export const UNIT_STATUS = ["Vacant", "Listed", "Rented", "Not available"] as const;
export const RENTER_STATUS = ["Looking", "Placed", "Inactive"] as const;
export const SOURCES = [
  "Phone call", "Walk-in", "Referral", "Kijiji", "Facebook Marketplace",
  "Rentals.ca", "Lawn sign", "Website form", "Other",
];
export const PROP_TYPES = ["House", "Duplex", "Apartment building", "Basement suite", "Townhouse", "Condo", "Other"];
export const CONTACT_PREFS = ["Phone", "Text", "Email"];
export const FEE_TYPES = ["% of rent", "Flat monthly"];
export const RENT_AGAIN = ["Yes", "Maybe", "No"];
