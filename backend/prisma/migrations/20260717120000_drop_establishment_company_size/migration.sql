-- Drop tranche d'effectifs on Establishment: donnée trop bruitée (agence vs
-- groupe) et couverture SIRENE trop faible pour être exploitable.
ALTER TABLE "Establishment" DROP COLUMN IF EXISTS "companySize";
