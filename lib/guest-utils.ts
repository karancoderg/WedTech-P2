import { WeddingFunction } from "@/lib/types";

export function deriveFunctionsForSide(
  side: "bride" | "groom" | "both" | string,
  allFunctions: WeddingFunction[]
): string[] {
  if (side === "both") return allFunctions.map((f) => f.id);

  return allFunctions
    .filter((f) => {
      const name = f.name.toLowerCase();
      const isJoint = name.includes("joint") || name.includes("combined") || name.includes("reception");
      if (isJoint) return true;

      if (side === "bride") {
        return (
          name.includes("bride") ||
          name.includes("mehndi") ||
          name.includes("haldi") ||
          name.includes("sangeet") ||
          name.includes("wedding") || // Usually joint but just in case
          name.includes("phera")
        );
      } else if (side === "groom") {
        return (
          name.includes("groom") ||
          name.includes("haldi") ||
          name.includes("sangeet") ||
          name.includes("wedding") ||
          name.includes("phera") ||
          name.includes("baraat")
        );
      }
      return false; // Default to not including if side is unknown and function isn't joint
    })
    .map((f) => f.id);
}
